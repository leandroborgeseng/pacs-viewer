import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateIntegrationPacsDto } from './dto/update-integration-pacs.dto';

export type ResolvedPacsEndpoints = {
  /** Ligado através de IP/porta/path na BD, senão só variáveis de ambiente. */
  pacsConfiguredVia: 'database' | 'environment';
  dicomWebRoot: string;
  httpRoot: string;
  orthancUsername: string | undefined;
  orthancPassword: string | undefined;
  /** URL portal para reescrita OHIF (`WEB_ORIGIN` ou `integration_settings`). */
  webOriginPublic: string | undefined;
  laudoManufacturer: string | undefined;
  laudoSeriesNumber: string | undefined;
  dicomProxyDebug: boolean;
};

export type ResolvedPacsEndpointsPublic = Omit<
  ResolvedPacsEndpoints,
  'orthancPassword'
>;

export type PacsAdminViewDto = {
  orthancUseTls: boolean;
  orthancHost: string | null;
  orthancPort: number;
  orthancDicomWebPath: string;
  orthancUsername: string | null;
  /** Retorna verdadeiro quando existe senha no banco (nunca devolvida ao cliente). */
  orthancPasswordStored: boolean;
  webOriginPublic: string | null;
  laudoManufacturer: string | null;
  laudoSeriesNumber: string | null;
  dicomProxyDebug: boolean;
  resolved: ResolvedPacsEndpointsPublic & {
    /** Origem combinada BD + fallback .env para CORS e proxy DICOM. */
    webOriginEffective?: string | undefined;
    effectiveBasicAuth: boolean;
  };
};

function normalizeOrigin(o: string): string {
  return o.trim().replace(/\/+$/, '');
}

export function splitWebOrigins(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((p) => normalizeOrigin(p))
    .filter(Boolean);
}

function normalizeDicomPath(p: string): string {
  const t = p.trim();
  if (!t.length) return '/dicom-web';
  const slash = t.startsWith('/') ? t : `/${t}`;
  return slash.replace(/\/+$/, '') || '/dicom-web';
}

/** Host já sem [] — acrescenta se IPv6. */
export function bracketHostForUrl(hostRaw: string): string {
  const h = hostRaw.trim();
  if (!h.includes(':')) return h;
  if (h.startsWith('[')) return h;
  return `[${h}]`;
}

/** Deriva base REST do mesmo URL DICOMweb (comportamento legado `.env`). */
export function deriveHttpRootFromEnvDicomWeb(envDicom: string): string {
  const u = String(envDicom).replace(/\/$/, '');
  const m = u.match(/^(.*)\/dicom-web$/i);
  return m?.[1] ?? u;
}

@Injectable()
export class IntegrationService implements OnModuleInit {
  private readonly logger = new Logger(IntegrationService.name);
  private cachedResolved!: ResolvedPacsEndpoints;
  /** Origins exactos permitidos pelo CORS (BD + WEB_ORIGIN). */
  private cachedCorsOrigins = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  async onModuleInit() {
    await this.refreshFromDatabase();
  }

  get resolved(): ResolvedPacsEndpoints {
    return this.cachedResolved;
  }

  /** Lista exacta combinada durante o último refresh. */
  get corsAllowedOrigins(): string[] {
    return [...this.cachedCorsOrigins];
  }

  /**
   * CORS antes do primeiro refresh: usa só `WEB_ORIGIN`.
   */
  provisionalCorsFallback(): string[] {
    return splitWebOrigins(this.config.get<string>('WEB_ORIGIN'));
  }

  isBrowserOriginAllowed(
    requestOrigin: string | undefined,
    opts: {
      nodeEnv?: string | undefined;
      allowRailwayPublic?: boolean | undefined;
    },
  ): boolean {
    if (!requestOrigin || !requestOrigin.trim()) return true;
    const normalized = normalizeOrigin(requestOrigin);
    if (this.cachedCorsOrigins.has(normalized)) return true;

    const allowRailwayPublic =
      opts.allowRailwayPublic !== false &&
      opts.nodeEnv === 'production' &&
      this.config.get<string>('CORS_ALLOW_RAILWAY_PUBLIC') !== '0';

    if (allowRailwayPublic) {
      try {
        const { hostname, protocol } = new URL(normalized);
        const rail =
          hostname === 'up.railway.app' || hostname.endsWith('.up.railway.app');
        if (protocol === 'https:' && rail) return true;
      } catch {
        /* ignore */
      }
    }
    return false;
  }

  async getPacsAdminView(): Promise<PacsAdminViewDto> {
    const row =
      (await this.prisma.integrationSettings.findUnique({
        where: { id: 'default' },
      })) ?? null;
    const r = this.resolved;
    const wo = splitWebOrigins(this.config.get<string>('WEB_ORIGIN'));
    const webOriginEffective =
      r.webOriginPublic?.replace(/\/+$/, '')?.trim() || wo[0] || undefined;
    const effectiveBasicAuth = !!(r.orthancUsername && r.orthancPassword?.length);
    const { orthancPassword: _omitPw, ...rPublic } = r;

    return {
      orthancUseTls: row?.orthancUseTls ?? false,
      orthancHost: row?.orthancHost ?? null,
      orthancPort: row?.orthancPort ?? 8042,
      orthancDicomWebPath: row?.orthancDicomWebPath ?? '/dicom-web',
      orthancUsername: row?.orthancUsername?.trim() ? row.orthancUsername.trim() : null,
      orthancPasswordStored: !!(row?.orthancPassword && row.orthancPassword.length > 0),
      webOriginPublic: row?.webOriginPublic?.trim() || null,
      laudoManufacturer: row?.laudoManufacturer?.trim() || null,
      laudoSeriesNumber: row?.laudoSeriesNumber?.trim() || null,
      dicomProxyDebug: Boolean(row?.dicomProxyDebug ?? false),
      resolved: {
        ...rPublic,
        webOriginEffective,
        effectiveBasicAuth,
      },
    };
  }

  async applyPatch(dto: UpdateIntegrationPacsDto): Promise<PacsAdminViewDto> {
    const cur =
      (await this.prisma.integrationSettings.findUnique({
        where: { id: 'default' },
      })) ?? null;

    const nextHost =
      dto.orthancHost !== undefined
        ? dto.orthancHost.trim().length > 0
          ? dto.orthancHost.trim()
          : null
        : (cur?.orthancHost ?? null);

    let nextPass = cur?.orthancPassword ?? null;
    if (dto.clearStoredOrthancPassword) nextPass = null;
    else if (
      dto.orthancPasswordNew !== undefined &&
      dto.orthancPasswordNew.trim().length > 0
    ) {
      nextPass = dto.orthancPasswordNew.trim();
    }

    const nextUsername =
      dto.orthancUsername !== undefined
        ? dto.orthancUsername.trim().length > 0
          ? dto.orthancUsername.trim()
          : null
        : (cur?.orthancUsername ?? null);

    const nextWebOrigin =
      dto.webOriginPublic !== undefined
        ? dto.webOriginPublic.trim().length > 0
          ? normalizeOrigin(dto.webOriginPublic)
          : null
        : (cur?.webOriginPublic ?? null);

    const merged = {
      id: 'default',
      orthancUseTls:
        dto.orthancUseTls ??
        cur?.orthancUseTls ??
        false,
      orthancHost: nextHost,
      orthancPort: dto.orthancPort ?? cur?.orthancPort ?? 8042,
      orthancDicomWebPath:
        dto.orthancDicomWebPath !== undefined
          ? normalizeDicomPath(dto.orthancDicomWebPath)
          : (cur?.orthancDicomWebPath ?? '/dicom-web'),
      orthancUsername: nextUsername,
      orthancPassword: nextPass,
      webOriginPublic: nextWebOrigin,
      laudoManufacturer:
        dto.laudoManufacturer !== undefined
          ? dto.laudoManufacturer.trim().length > 0
            ? dto.laudoManufacturer.trim()
            : null
          : (cur?.laudoManufacturer ?? null),
      laudoSeriesNumber:
        dto.laudoSeriesNumber !== undefined
          ? dto.laudoSeriesNumber.trim().length > 0
            ? dto.laudoSeriesNumber.trim()
            : null
          : (cur?.laudoSeriesNumber ?? null),
      dicomProxyDebug:
        dto.dicomProxyDebug ??
        cur?.dicomProxyDebug ??
        String(this.config.get<string>('DICOMWEB_PROXY_DEBUG') ?? '').trim() ===
          '1',
    };

    await this.prisma.integrationSettings.upsert({
      where: { id: 'default' },
      create: merged,
      update: {
        orthancUseTls: merged.orthancUseTls,
        orthancHost: merged.orthancHost,
        orthancPort: merged.orthancPort,
        orthancDicomWebPath: merged.orthancDicomWebPath,
        orthancUsername: merged.orthancUsername,
        orthancPassword: merged.orthancPassword,
        webOriginPublic: merged.webOriginPublic,
        laudoManufacturer: merged.laudoManufacturer,
        laudoSeriesNumber: merged.laudoSeriesNumber,
        dicomProxyDebug: merged.dicomProxyDebug,
      },
    });

    await this.refreshFromDatabase();
    return this.getPacsAdminView();
  }

  async testOrthancConnectivity(): Promise<{
    ok: boolean;
    httpStatus?: number;
    orthancReachable?: boolean;
    message: string;
  }> {
    const r = this.resolved;
    const url = `${r.httpRoot}/system`;
    const headers: Record<string, string> = { Accept: 'application/json' };
    const u = r.orthancUsername;
    const pw = r.orthancPassword;
    if (u?.length && pw?.length) {
      headers.Authorization = `Basic ${Buffer.from(`${u}:${pw}`).toString('base64')}`;
    }

    try {
      const resp = await firstValueFrom(
        this.http.get(url, {
          headers,
          validateStatus: () => true,
          timeout: 12_000,
        }),
      );
      const reachable = resp.status === 200;
      return {
        ok: reachable,
        httpStatus: resp.status,
        orthancReachable: reachable,
        message: reachable
          ? `Orthanc REST respondeu OK em GET /system.`
          : `Orthanc REST respondeu HTTP ${resp.status} em GET /system (credenciais ou URL?).`,
      };
    } catch (e) {
      if (isAxiosError(e)) {
        return {
          ok: false,
          httpStatus: e.response?.status,
          orthancReachable: false,
          message: `Falha de rede ao contactar Orthanc (${e.code ?? e.message}).`,
        };
      }
      return {
        ok: false,
        message: `Erro ao testar ligacao: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  logBootstrapSummary(): void {
    const r = this.resolved;
    const fromDb = r.webOriginPublic?.trim().replace(/\/+$/, '').trim();
    const fromEnv = splitWebOrigins(this.config.get<string>('WEB_ORIGIN'))[0];
    const webComb =
      (fromDb?.length ?? 0) > 0
        ? fromDb!
        : (fromEnv?.length ?? 0) > 0
          ? fromEnv!
          : '(vazio — sem WEB_ORIGIN na env nem BD)';
    this.logger.log(
      JSON.stringify({
        event: 'pacs.bootstrap',
        pacsConfiguredVia: r.pacsConfiguredVia,
        ORTHANC_DICOMWEB_EFFECTIVE: r.dicomWebRoot,
        ORTHANC_HTTP_EFFECTIVE: r.httpRoot,
        WEB_ORIGIN_EFFECTIVE_HINT: webComb,
        dicom_proxy_debug_effective: r.dicomProxyDebug,
        basic_auth_configured:
          !!(r.orthancUsername && r.orthancPassword?.length),
      }),
    );
  }

  private async refreshFromDatabase(): Promise<void> {
    const row =
      (await this.prisma.integrationSettings.findUnique({
        where: { id: 'default' },
      })) ?? null;

    const envUser = this.config.get<string>('ORTHANC_USERNAME')?.trim();
    const envPass = this.config.get<string>('ORTHANC_PASSWORD')?.trim();

    let resolved: ResolvedPacsEndpoints;
    const hostUi = row?.orthancHost?.trim();
    const useTls = row?.orthancUseTls ?? false;
    const port = row?.orthancPort ?? 8042;

    if (hostUi?.length) {
      const scheme = useTls ? 'https' : 'http';
      const hh = bracketHostForUrl(hostUi);
      const httpRoot = `${scheme}://${hh}:${port}`.replace(/\/$/, '');
      const dip = normalizeDicomPath(row?.orthancDicomWebPath ?? '/dicom-web');
      const dicomWebRoot = `${httpRoot}${dip}`.replace(/\/$/, '');

      const uDb = row?.orthancUsername?.trim();
      const pDb = row?.orthancPassword?.trim();

      resolved = {
        pacsConfiguredVia: 'database',
        dicomWebRoot,
        httpRoot,
        orthancUsername: uDb ?? undefined,
        orthancPassword: pDb ?? undefined,
        webOriginPublic: row?.webOriginPublic?.trim() || undefined,
        laudoManufacturer: row?.laudoManufacturer?.trim() || undefined,
        laudoSeriesNumber: row?.laudoSeriesNumber?.trim() || undefined,
        dicomProxyDebug:
          row?.dicomProxyDebug ??
          String(this.config.get<string>('DICOMWEB_PROXY_DEBUG') ?? '').trim() ===
            '1',
      };
    } else {
      const dicomRaw =
        this.config.get<string>('ORTHANC_DICOMWEB_ROOT')?.trim() ??
        'http://localhost:8042/dicom-web';
      const dicomWebRoot = String(dicomRaw).replace(/\/$/, '');
      const httpConfigured = this.config.get<string>('ORTHANC_HTTP_ROOT')?.trim();
      const httpRoot = (
        httpConfigured?.length ? httpConfigured.replace(/\/$/, '') : deriveHttpRootFromEnvDicomWeb(dicomWebRoot)
      ).replace(/\/$/, '');

      if (!httpConfigured && !/\/dicom-web$/i.test(dicomWebRoot)) {
        this.logger.warn(
          JSON.stringify({
            event: 'orthanc.rest_derive',
            hint: 'ORTHANC_DICOMWEB_ROOT sem sufixo /dicom-web; REST HTTP usa o mesmo valor.',
          }),
        );
      }

      resolved = {
        pacsConfiguredVia: 'environment',
        dicomWebRoot,
        httpRoot,
        orthancUsername: envUser?.length ? envUser : undefined,
        orthancPassword: envPass?.length ? envPass : undefined,
        webOriginPublic: row?.webOriginPublic?.trim() || undefined,
        laudoManufacturer: row?.laudoManufacturer?.trim() || undefined,
        laudoSeriesNumber: row?.laudoSeriesNumber?.trim() || undefined,
        dicomProxyDebug:
          row?.dicomProxyDebug ??
          String(this.config.get<string>('DICOMWEB_PROXY_DEBUG') ?? '').trim() ===
            '1',
      };
    }

    this.cachedResolved = resolved;
    const origins = new Set<string>();
    for (const o of splitWebOrigins(this.config.get<string>('WEB_ORIGIN'))) {
      if (o) origins.add(o);
    }
    const dbWeb = resolved.webOriginPublic?.replace(/\/+$/, '').trim();
    if (dbWeb) origins.add(dbWeb);
    this.cachedCorsOrigins = origins;
  }
}
