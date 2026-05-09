import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';

/** Cliente mínimo para QIDO-RS no Orthanc (catálogo de estudos). */
@Injectable()
export class OrthancDicomWebClient {
  private readonly logger = new Logger(OrthancDicomWebClient.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private baseUrl(): string {
    const base =
      this.config.get<string>('ORTHANC_DICOMWEB_ROOT') ??
      'http://localhost:8042/dicom-web';
    return base.replace(/\/$/, '');
  }

  private upstreamHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/dicom+json',
    };
    const user = this.config.get<string>('ORTHANC_USERNAME');
    const pass = this.config.get<string>('ORTHANC_PASSWORD');
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
    const url = `${this.baseUrl()}/studies`;
    try {
      const response = await firstValueFrom(
        this.http.get<unknown>(url, {
          headers: this.upstreamHeaders(),
          validateStatus: () => true,
        }),
      );
      if (response.status === 401 || response.status === 403) {
        this.logger.warn(
          JSON.stringify({
            event: 'orthanc.qido_auth',
            url,
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
            url,
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
            url,
            hint: 'corpo não é JSON array (application/dicom+json esperado)',
          }),
        );
        throw new ServiceUnavailableException(
          'Resposta do PACS em /studies não é uma lista DICOM JSON. Confirme que o URL aponta para …/dicom-web.',
        );
      }
      return data;
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      if (isAxiosError(e)) {
        this.logger.error(
          JSON.stringify({
            event: 'orthanc.qido_network',
            url,
            code: e.code ?? null,
            message: e.message,
            status: e.response?.status ?? null,
          }),
        );
        const code = e.code;
        const hint =
          code === 'ECONNREFUSED'
            ? 'ligação recusada (porta, firewall ou PACS desligado).'
            : code === 'ETIMEDOUT' || code === 'ECONNABORTED'
              ? 'timeout ao contactar o PACS.'
              : code === 'ENOTFOUND'
                ? 'host do PACS não encontrado (DNS ou URL errado).'
                : code === 'CERT_HAS_EXPIRED' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
                  ? 'falha TLS ao contactar o PACS (certificado).'
                  : `erro de rede (${code ?? 'desconhecido'}).`;
        throw new ServiceUnavailableException(
          `PACS indisponível: ${hint} Na Railway/cloud, defina ORTHANC_DICOMWEB_ROOT com URL acessível **a partir do servidor da API** (não use localhost do teu PC).`,
        );
      }
      this.logger.error(
        JSON.stringify({
          event: 'orthanc.qido_unknown',
          url,
          message: e instanceof Error ? e.message : String(e),
        }),
      );
      throw new ServiceUnavailableException(
        'Não foi possível obter estudos no PACS (DICOMweb). Verifique ORTHANC_DICOMWEB_ROOT e os logs da API.',
      );
    }
  }
}
