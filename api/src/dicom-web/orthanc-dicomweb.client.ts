import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/** Cliente mínimo para QIDO-RS no Orthanc (catálogo de estudos). */
@Injectable()
export class OrthancDicomWebClient {
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
      if (response.status >= 400) {
        throw new Error(`Orthanc HTTP ${response.status}`);
      }
      const data = response.data;
      if (!Array.isArray(data)) {
        throw new Error('Resposta /studies inválida (esperado array)');
      }
      return data;
    } catch (_e) {
      throw new ServiceUnavailableException(
        'Não foi possível obter estudos no PACS (DICOMweb). Verifique ORTHANC_DICOMWEB_ROOT, credenciais e conectividade.',
      );
    }
  }
}
