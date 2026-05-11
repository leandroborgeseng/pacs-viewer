import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { Request, Response } from 'express';
import { DicomAccessService } from './dicom-access.service';
import { RequestUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import {
  IntegrationService,
  splitWebOrigins,
} from '../integration/integration.service';

const STUDY_UID_TAG = '0020000D';

@Injectable()
export class DicomWebService implements OnModuleInit {
  private readonly logger = new Logger(DicomWebService.name);
  /** Evita spam quando WEB_ORIGIN não está definido. */
  private warnedMissingWebOrigin = false;

  constructor(
    private http: HttpService,
    private config: ConfigService,
    private access: DicomAccessService,
    private integration: IntegrationService,
  ) {}

  onModuleInit() {
    const wo = splitWebOrigins(this.config.get<string>('WEB_ORIGIN'));
    const r = this.integration.resolved;
    const webEff =
      (r.webOriginPublic?.trim().replace(/\/+$/, '') || wo[0] || '').trim() ||
      null;
    const proxyDebug = r.dicomProxyDebug;
    this.logJson({
      event: 'dicomweb.bootstrap',
      WEB_ORIGIN_env_defined: wo.length > 0,
      web_origin_database_defined: Boolean(r.webOriginPublic?.trim()),
      browser_proxy_dicomweb: webEff
        ? `${webEff.replace(/\/+$/, '')}/bb-api/dicomweb`
        : null,
      ORTHANC_DICOMWEB_ROOT_effective: r.dicomWebRoot,
      pacs_configured_via: r.pacsConfiguredVia,
      DICOMWEB_PROXY_DEBUG_effective: proxyDebug,
      ...(webEff
        ? {}
        : {
            problem:
              'Sem URL do portal (.env WEB_ORIGIN ou Admin → Integração) o proxy não reescreve URLs 00081190 no JSON; o OHIF pode falhar (CORS).',
          }),
    });
  }

  private proxyDebugEnabled(): boolean {
    return this.integration.resolved.dicomProxyDebug;
  }

  private upstreamBase(): string {
    return this.integration.resolved.dicomWebRoot;
  }

  /**
   * URL pública do DICOMweb vista pelo navegador (proxy Next no portal).
   * Sem isto, metadados Orthanc trazem http(s)://orthanc/... e o OHIF falha (CORS/CSP).
   */
  private browserPublicDicomwebRoot(): string | null {
    const r = this.integration.resolved;
    const prim =
      (r.webOriginPublic?.trim().replace(/\/+$/, '') ||
        splitWebOrigins(this.config.get<string>('WEB_ORIGIN'))[0]) ??
      '';
    const web = prim.trim().replace(/\/+$/, '');
    if (!web) return null;
    return `${web}/bb-api/dicomweb`;
  }

  async proxy(req: Request, res: Response, user: RequestUser) {
    const upstreamUrl = this.buildUpstreamUrl(req);
    if (this.proxyDebugEnabled()) {
      /* Um pedido = uma linha; útil quando o OHIF faz dezenas de chamadas encadeadas. */
      this.logJson({
        event: 'dicomweb.proxy_debug',
        upstream: upstreamUrl.pathname + upstreamUrl.search,
        jwt_role: user.role,
      });
    }
    const studyFromPath = this.extractStudyUidFromPath(upstreamUrl.pathname);
    const allowed =
      user.role === Role.ADMIN
        ? new Set<string>()
        : await this.access.getAllowedStudyInstanceUIDs(user);

    if (studyFromPath && !this.isAllowed(studyFromPath, allowed, user.role)) {
      this.logJson({
        event: 'dicomweb.access_denied',
        clientPath: this.redactClientPath(req.originalUrl ?? ''),
        upstreamPath: upstreamUrl.pathname,
        studyInstanceUID: studyFromPath,
        userId: user.sub,
        role: user.role,
      });
      throw new ForbiddenException('Sem acesso a este estudo DICOMweb');
    }

    const method = (req.method ?? 'GET').toUpperCase();
    const headers = this.buildUpstreamHeaders(req);
    const t0 = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs =
        Math.round(Number(process.hrtime.bigint() - t0) / 1e6) / 1000;
      const len = res.getHeader('content-length');
      this.logJson({
        event: 'dicomweb.proxy',
        method,
        clientPath: this.redactClientPath(req.originalUrl ?? ''),
        upstreamPath: `${upstreamUrl.pathname}${upstreamUrl.search}`,
        statusCode: res.statusCode,
        durationMs,
        userId: user.sub,
        role: user.role,
        bytesOut:
          typeof len === 'number'
            ? len
            : typeof len === 'string'
              ? Number.parseInt(len, 10)
              : undefined,
      });
    });

    try {
      const response = await firstValueFrom(
        this.http.request<ArrayBuffer>({
          method: method as never,
          url: upstreamUrl.toString(),
          headers,
          data: ['GET', 'HEAD'].includes(method) ? undefined : req,
          responseType: 'arraybuffer',
          validateStatus: () => true,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }),
      );

      const contentType = String(response.headers['content-type'] ?? '');
      if (response.status >= 400) {
        this.logJson({
          event: 'dicomweb.upstream_bad_status',
          upstreamHttpStatus: response.status,
          upstreamPath: upstreamUrl.pathname,
          upstreamQueryHasParams: upstreamUrl.search.length > 1,
          contentType,
          hint:
            response.status === 401 || response.status === 403
              ? 'Configure as credenciais do PACS em Administração → Integração (ou orthanc_* no .env).'
              : 'Confirmar plugin DICOMweb, IP/porta e caminho até /dicom-web nas definições de integração.',
        });
      }
      const p = upstreamUrl.pathname;
      const isJsonStudies =
        method === 'GET' &&
        p === '/studies' &&
        contentType.includes('application/dicom+json');

      if (isJsonStudies && user.role !== Role.ADMIN) {
        const filtered = this.filterStudiesResponse(
          Buffer.from(response.data as ArrayBuffer),
          allowed,
        );
        const out = this.rewriteDicomJsonBodyIfNeeded(
          filtered,
          contentType,
        );
        this.forwardHeaders(
          res,
          this.rewriteOutgoingHeaders(response.headers),
          out.length,
        );
        res.status(response.status).send(out);
        return;
      }

      const body = this.rewriteDicomJsonBodyIfNeeded(
        Buffer.from(response.data as ArrayBuffer),
        contentType,
      );
      this.forwardHeaders(
        res,
        this.rewriteOutgoingHeaders(response.headers),
        body.length,
      );
      res.status(response.status).send(body);
    } catch (err) {
      this.logJson({
        event: 'dicomweb.upstream_error',
        clientPath: this.redactClientPath(req.originalUrl ?? ''),
        upstreamPath: upstreamUrl.toString().split('?')[0],
        method,
        userId: user.sub,
        role: user.role,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new ServiceUnavailableException(
        'Orthanc/DICOMweb indisponível. Verifique IP/porta, URL DICOMweb e credenciais (Administração → Integração).',
      );
    }
  }

  private logJson(payload: Record<string, unknown>) {
    this.logger.log(JSON.stringify(payload));
  }

  /** Remove credenciais sensíveis da query (ex.: access_token no OHIF). */
  private redactClientPath(pathAndQuery: string): string {
    const qIdx = pathAndQuery.indexOf('?');
    if (qIdx < 0) return pathAndQuery;
    const path = pathAndQuery.slice(0, qIdx);
    const qs = pathAndQuery.slice(qIdx + 1);
    try {
      const sp = new URLSearchParams(qs);
      if (sp.has('access_token')) sp.set('access_token', '[redacted]');
      const next = sp.toString();
      return next ? `${path}?${next}` : path;
    } catch {
      return `${path}?[unparsed-query]`;
    }
  }

  private filterStudiesResponse(buf: Buffer, allowed: Set<string>): Buffer {
    try {
      const text = buf.toString('utf8');
      const parsed = JSON.parse(text) as unknown[];
      if (!Array.isArray(parsed)) return buf;
      const next = parsed.filter((item) => {
        const uid = this.readStudyUidFromDicomJson(item);
        return uid && allowed.has(uid);
      });
      return Buffer.from(JSON.stringify(next), 'utf8');
    } catch {
      return buf;
    }
  }

  private readStudyUidFromDicomJson(item: unknown): string | null {
    if (!item || typeof item !== 'object') return null;
    const tag = (item as Record<string, { Value?: string[] }>)[STUDY_UID_TAG];
    const v = tag?.Value?.[0];
    return typeof v === 'string' ? v : null;
  }

  private isAllowed(
    studyUid: string,
    allowed: Set<string>,
    role: Role,
  ): boolean {
    if (role === Role.ADMIN) return true;
    return allowed.has(studyUid);
  }

  private extractStudyUidFromPath(pathname: string): string | null {
    const m = pathname.match(/\/studies\/([^/]+)/);
    return m?.[1] ? decodeURIComponent(m[1]) : null;
  }

  private buildUpstreamHeaders(req: Request): Record<string, string> {
    const forward: Record<string, string> = {};
    const hop = new Set([
      'host',
      'connection',
      'content-length',
      'authorization',
    ]);
    for (const [k, v] of Object.entries(req.headers)) {
      if (!v || hop.has(k.toLowerCase())) continue;
      if (Array.isArray(v)) forward[k] = v.join(', ');
      else forward[k] = v;
    }
    const r = this.integration.resolved;
    const user = r.orthancUsername;
    const pass = r.orthancPassword;
    if (user && pass) {
      const token = Buffer.from(`${user}:${pass}`).toString('base64');
      forward['authorization'] = `Basic ${token}`;
    }
    const accept = forward['accept'] ?? req.headers['accept'];
    forward['accept'] =
      typeof accept === 'string' && accept.length > 0
        ? accept
        : 'application/dicom+json, multipart/related; type="application/dicom+xml"';
    return forward;
  }

  private forwardHeaders(
    res: Response,
    incoming: Record<string, unknown>,
    bodyLength: number,
  ) {
    const skip = new Set([
      'connection',
      'transfer-encoding',
      'content-length',
      'content-encoding',
    ]);
    for (const [key, val] of Object.entries(incoming)) {
      if (!val || skip.has(key.toLowerCase())) continue;
      if (Array.isArray(val)) {
        res.setHeader(key, val as string[]);
      } else if (typeof val === 'string') {
        res.setHeader(key, val);
      }
    }
    res.setHeader('content-length', bodyLength.toString());
  }

  private buildUpstreamUrl(req: Request): URL {
    const base = this.upstreamBase();
    const rawPath = req.originalUrl.split('?')[0] ?? '';
    const searchParams = new URLSearchParams(
      req.originalUrl.includes('?')
        ? req.originalUrl.slice(req.originalUrl.indexOf('?') + 1)
        : '',
    );
    searchParams.delete('access_token');
    const q = searchParams.toString();
    const query = q ? `?${q}` : '';

    let relative = rawPath;
    for (const p of ['/api/dicomweb', '/dicomweb', '/bb-api/dicomweb']) {
      if (relative.startsWith(p)) {
        relative = relative.slice(p.length) || '/';
        break;
      }
    }
    if (!relative.startsWith('/')) relative = `/${relative}`;
    return new URL(`${base}${relative}${query}`);
  }

  /** Reescreve URLs Orthanc em JSON; noop se WEB_ORIGIN ausente. */
  private rewriteDicomJsonBodyIfNeeded(body: Buffer, contentType: string): Buffer {
    const publicRoot = this.browserPublicDicomwebRoot();
    const ct = contentType.toLowerCase();
    if (!publicRoot) {
      if (ct.includes('dicom+json')) {
        if (!this.warnedMissingWebOrigin) {
          this.warnedMissingWebOrigin = true;
          this.logger.warn(
            JSON.stringify({
              event: 'dicomweb.rewrite_skipped',
              reason:
                'URL pública do portal vazia (Admin Integração ou WEB_ORIGIN)',
              fix: 'Defina URL pública do portal na administração ou WEB_ORIGIN.',
            }),
          );
        }
      }
      return body;
    }
    if (!ct.includes('json')) return body;
    try {
      const text = body.toString('utf8');
      const parsed = JSON.parse(text) as unknown;
      const out = this.rewriteDicomJsonUrlsDeep(parsed, publicRoot);
      const rewritten = Buffer.from(JSON.stringify(out), 'utf8');
      if (
        this.proxyDebugEnabled() &&
        ct.includes('dicom+json') &&
        text !== rewritten.toString('utf8')
      ) {
        this.logJson({
          event: 'dicomweb.rewrite_applied',
          publicRootLengthChars: publicRoot.length,
          bodyBytesBefore: body.length,
          bodyBytesAfter: rewritten.length,
        });
      }
      return rewritten;
    } catch {
      return body;
    }
  }

  /** Corrige Location com destino Orthanc. */
  private rewriteOutgoingHeaders(
    incoming: Record<string, unknown>,
  ): Record<string, unknown> {
    const publicRoot = this.browserPublicDicomwebRoot();
    if (!publicRoot) return incoming;
    const loc = incoming['location'];
    const s = Array.isArray(loc) ? loc[0] : loc;
    if (typeof s !== 'string') return incoming;
    const n = this.rewriteUrlString(s, publicRoot);
    if (n === s) return incoming;
    return { ...incoming, location: n };
  }

  private rewriteDicomJsonUrlsDeep(data: unknown, publicBase: string): unknown {
    if (typeof data === 'string') return this.rewriteUrlString(data, publicBase);
    if (Array.isArray(data))
      return data.map((x) => this.rewriteDicomJsonUrlsDeep(x, publicBase));
    if (data && typeof data === 'object')
      return Object.fromEntries(
        Object.entries(data).map(([k, v]) => [
          k,
          this.rewriteDicomJsonUrlsDeep(v, publicBase),
        ]),
      );
    return data;
  }

  /**
   * Substitui qualquer URL cujo path contenha `/dicom-web` pelo proxy do portal.
   */
  private rewriteUrlString(s: string, publicBase: string): string {
    if (!s.startsWith('http://') && !s.startsWith('https://')) return s;
    try {
      const u = new URL(s);
      const lower = u.pathname.toLowerCase();
      const marker = '/dicom-web';
      const idx = lower.indexOf(marker);
      if (idx === -1) return s;
      const rest = u.pathname.slice(idx + marker.length) + u.search;
      return `${publicBase}${rest}`;
    } catch {
      return s;
    }
  }
}