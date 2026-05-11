import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';
import { IntegrationService } from '../integration/integration.service';

/** Tags hex pedidas ao QIDO (Study Description inclui `(0008,1030)`). */
const STUDY_LEVEL_QIDO_INCLUDEFIELDS = [
  '0020000D',
  '00080020',
  '00081030',
  '00080061',
  '00100010',
  '00100020',
  '00201206',
  '00201208',
] as const;

/** Cliente mínimo para QIDO-RS no Orthanc (catálogo de estudos). */
@Injectable()
export class OrthancDicomWebClient {
  private readonly logger = new Logger(OrthancDicomWebClient.name);

  constructor(
    private readonly http: HttpService,
    private readonly integration: IntegrationService,
  ) {}

  private baseUrl(): string {
    return this.integration.resolved.dicomWebRoot;
  }

  private upstreamHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/dicom+json',
    };
    const r = this.integration.resolved;
    const user = r.orthancUsername;
    const pass = r.orthancPassword;
    if (user && pass) {
      headers['Authorization'] =
        `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
    }
    return headers;
  }

  /**
   * Lista todos os estudos em formato DICOM JSON (array de objetos com tags).
   */
  async fetchStudiesDicomJson(): Promise<unknown[]> {
    const root = this.baseUrl().replace(/\/+$/, '');
    const q = STUDY_LEVEL_QIDO_INCLUDEFIELDS.map(
      (tag) => `includefield=${encodeURIComponent(tag)}`,
    ).join('&');
    const urlsTried = [`${root}/studies?${q}`, `${root}/studies`] as const;
    let urlForLog: string = urlsTried[0];
    try {
      let response = await firstValueFrom(
        this.http.get<unknown>(urlsTried[0], {
          headers: this.upstreamHeaders(),
          validateStatus: () => true,
        }),
      );

      // Alguns gateways rejeitam `includefield`; o Orthanc típico aceita-o.
      if (response.status === 401 || response.status === 403) {
        this.logger.warn(
          JSON.stringify({
            event: 'orthanc.qido_auth',
            url: urlsTried[0],
            status: response.status,
          }),
        );
        throw new ServiceUnavailableException(
          'PACS rejeitou o acesso (credenciais). Defina ORTHANC_USERNAME e ORTHANC_PASSWORD na API se o Orthanc exige Basic Auth.',
        );
      }

      if (response.status >= 400) {
        this.logger.warn(
          JSON.stringify({
            event: 'orthanc.qido_retry_no_includefield',
            firstStatus: response.status,
            firstUrl: urlsTried[0],
          }),
        );
        urlForLog = urlsTried[1];
        response = await firstValueFrom(
          this.http.get<unknown>(urlsTried[1], {
            headers: this.upstreamHeaders(),
            validateStatus: () => true,
          }),
        );
      }

      if (response.status === 401 || response.status === 403) {
        this.logger.warn(
          JSON.stringify({
            event: 'orthanc.qido_auth',
            url: urlForLog,
            status: response.status,
          }),
        );
        throw new ServiceUnavailableException(
          'PACS rejeitou o acesso (credenciais). Defina ORTHANC_USERNAME e ORTHANC_PASSWORD na API se o Orthanc exige Basic Auth.',
        );
      }

      if (response.status >= 400) {
        this.logger.warn(
          JSON.stringify({
            event: 'orthanc.qido_http_error',
            url: urlForLog,
            status: response.status,
          }),
        );
        throw new ServiceUnavailableException(
          `PACS respondeu HTTP ${response.status} em /dicom-web/studies. Verifique o URL e o Orthanc.`,
        );
      }
      const data = response.data;
      if (!Array.isArray(data)) {
        this.logger.warn(
          JSON.stringify({
            event: 'orthanc.qido_parse',
            url: urlForLog,
            hint: 'corpo não é JSON array (application/dicom+json esperado)',
          }),
        );
        throw new ServiceUnavailableException(
          'Resposta do PACS em /studies não é uma lista DICOM JSON. Verifique se o URL aponta para …/dicom-web.',
        );
      }
      return data;
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      if (isAxiosError(e)) {
        this.logger.error(
          JSON.stringify({
            event: 'orthanc.qido_network',
            url: urlForLog,
            code: e.code ?? null,
            message: e.message,
            status: e.response?.status ?? null,
          }),
        );
        const code = e.code;
        const hint =
          code === 'ECONNREFUSED'
            ? 'conexão recusada (porta, firewall ou PACS desligado).'
            : code === 'ETIMEDOUT' || code === 'ECONNABORTED'
              ? 'timeout ao contactar o PACS.'
              : code === 'ENOTFOUND'
                ? 'host do PACS não encontrado (DNS ou URL errado).'
                : code === 'CERT_HAS_EXPIRED' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
                  ? 'falha TLS ao contactar o PACS (certificado).'
                  : `erro de rede (${code ?? 'desconhecido'}).`;
        throw new ServiceUnavailableException(
          `PACS indisponível: ${hint} Na Railway/cloud, defina ORTHANC_DICOMWEB_ROOT com URL acessível **a partir do servidor da API** (não use o localhost da sua máquina).`,
        );
      }
      this.logger.error(
        JSON.stringify({
          event: 'orthanc.qido_unknown',
          url: urlForLog,
          message: e instanceof Error ? e.message : String(e),
        }),
      );
      throw new ServiceUnavailableException(
        'Não foi possível obter estudos no PACS (DICOMweb). Verifique ORTHANC_DICOMWEB_ROOT e os logs da API.',
      );
    }
  }

  /**
   * Estudos com pelo menos uma série nas modalidades dadas (ex. DOC, OT — típ. laudo PDF encapsulado).
   * QIDO `/series?00080060=…`; falhas por modalidade ignoram-se (resultado parcial).
   */
  async fetchStudyUidsForSeriesModalities(
    modalities: readonly string[],
  ): Promise<Set<string>> {
    const base = this.baseUrl().replace(/\/+$/, '');
    const mods = modalities
      .map((raw) => raw.trim().toUpperCase())
      .filter(Boolean);
    const jobs = mods.map(async (mod) => {
      const chunk = new Set<string>();
      const url = `${base}/series?00080060=${encodeURIComponent(mod)}`;
      try {
        const response = await firstValueFrom(
          this.http.get<unknown>(url, {
            headers: this.upstreamHeaders(),
            validateStatus: () => true,
            timeout: 60_000,
          }),
        );
        if (response.status !== 200 || !Array.isArray(response.data)) {
          this.logger.warn(
            JSON.stringify({
              event: 'orthanc.qido_series_modal',
              url,
              modality: mod,
              status: response.status,
              hint: 'resposta inesperada; modalidade ignorada',
            }),
          );
          return chunk;
        }
        for (const row of response.data) {
          const uid = readDicomJsonStudyInstanceUid(row);
          if (uid) chunk.add(uid);
        }
      } catch (e) {
        this.logger.warn(
          JSON.stringify({
            event: 'orthanc.qido_series_modal_error',
            modality: mod,
            message: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return chunk;
    });
    const out = new Set<string>();
    for (const chunk of await Promise.all(jobs)) {
      for (const u of chunk) out.add(u);
    }
    return out;
  }
}

function readDicomJsonStudyInstanceUid(item: unknown): string | null {
  if (!item || typeof item !== 'object') return null;
  const t = (item as Record<string, { Value?: unknown[] } | undefined>)['0020000D'];
  const v = t?.Value?.[0];
  return typeof v === 'string' && v.length > 0 ? v : null;
}