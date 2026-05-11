import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';
import { IntegrationService } from '../integration/integration.service';

export type OrthancStudyTags = {
  StudyInstanceUID: string;
  StudyDate?: string;
  StudyTime?: string;
  StudyDescription?: string;
  PatientName?: string;
  PatientID?: string;
  PatientBirthDate?: string;
  PatientSex?: string;
  AccessionNumber?: string;
};

/**
 * Chamadas REST Orthanc não-DICOMweb (pesquisa, upload `/instances`).
 * URL e credencial vêm das definições de integração (`integration_settings`) ou `.env`.
 */
@Injectable()
export class OrthancRestClient {
  private readonly logger = new Logger(OrthancRestClient.name);

  constructor(
    private readonly http: HttpService,
    private readonly integration: IntegrationService,
  ) {}

  restRoot(): string {
    return this.integration.resolved.httpRoot;
  }

  private upstreamHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    const r = this.integration.resolved;
    const user = r.orthancUsername;
    const pass = r.orthancPassword;
    if (user && pass) {
      headers.Authorization = `Basic ${Buffer.from(`${user}:${pass}`).toString(
        'base64',
      )}`;
    }
    return headers;
  }

  /** Devolve lista de IDs internos Orthanc (recurso /studies/…). */
  async findStudiesByStudyInstanceUID(studyInstanceUID: string): Promise<string[]> {
    const root = this.restRoot();
    const url = `${root}/tools/find`;
    try {
      const resp = await firstValueFrom(
        this.http.post<unknown>(url, {
          Level: 'Study',
          Query: {
            StudyInstanceUID: studyInstanceUID,
          },
        }, {
          headers: {
            ...this.upstreamHeaders(),
            'Content-Type': 'application/json',
          },
          validateStatus: () => true,
        }),
      );
      if (resp.status !== 200) {
        throw new ServiceUnavailableException(
          `PACS (/tools/find) respondeu HTTP ${resp.status}. Confirme ORTHANC_HTTP_ROOT e credenciais.`,
        );
      }
      const rows = resp.data;
      if (!Array.isArray(rows)) {
        throw new ServiceUnavailableException(
          'PACS (/tools/find) devolveu formato inesperado.',
        );
      }
      return rows.filter((id): id is string => typeof id === 'string' && id.length > 0);
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      if (isAxiosError(e)) {
        this.logger.error(JSON.stringify({
          event: 'orthanc.find_network',
          url,
          status: e.response?.status,
          message: e.message,
        }));
        throw new ServiceUnavailableException(
          'Sem ligação ao PACS (REST Orthanc). Verifique ORTHANC_HTTP_ROOT / rede.',
        );
      }
      throw e;
    }
  }

  /** Agrega etiquetas paciente/estudo expostas pelo Orthanc. */
  async getStudyClinicalTagsForLaudo(orthancStudyId: string): Promise<OrthancStudyTags> {
    const root = this.restRoot();
    const url = `${root}/studies/${encodeURIComponent(orthancStudyId)}`;
    try {
      const resp = await firstValueFrom(
        this.http.get<Record<string, unknown>>(url, {
          headers: this.upstreamHeaders(),
          validateStatus: () => true,
        }),
      );
      if (resp.status !== 200 || !resp.data || typeof resp.data !== 'object') {
        throw new ServiceUnavailableException(
          `PACS não devolveu o estudo (HTTP ${resp.status}).`,
        );
      }
      const main = resp.data.MainDicomTags as Record<string, string | undefined> | undefined;
      const pat = resp.data.PatientMainDicomTags as
        | Record<string, string | undefined>
        | undefined;
      const m = main ?? {};
      const p = pat ?? {};

      const studyInstanceUID =
        typeof m.StudyInstanceUID === 'string' ? m.StudyInstanceUID.trim() : '';
      if (!studyInstanceUID.length) {
        throw new ServiceUnavailableException(
          'Resposta Orthanc sem StudyInstanceUID em MainDicomTags.',
        );
      }

      const pickMain = (...keys: string[]) => {
        for (const k of keys) {
          const v = m[k];
          if (typeof v === 'string' && v.trim().length > 0) return v.trim();
        }
        return undefined;
      };
      const pickPat = (...keys: string[]) => {
        for (const k of keys) {
          const v = p[k];
          if (typeof v === 'string' && v.trim().length > 0) return v.trim();
        }
        return undefined;
      };

      return {
        StudyInstanceUID: studyInstanceUID,
        StudyDate: pickMain('StudyDate'),
        StudyTime: pickMain('StudyTime'),
        StudyDescription: pickMain('StudyDescription'),
        AccessionNumber: pickMain('AccessionNumber'),
        PatientName: pickPat('PatientName'),
        PatientID: pickPat('PatientID'),
        PatientBirthDate: pickPat('PatientBirthDate'),
        PatientSex: pickPat('PatientSex'),
      };
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      if (isAxiosError(e)) {
        throw new ServiceUnavailableException(
          'Falhou obter etiquetas do estudo no Orthanc.',
        );
      }
      throw e;
    }
  }

  /** Faz ingestão de uma instância DICOM encapsulando PDF ou outra IOD. */
  async uploadDicom(buf: Buffer): Promise<{ orthancInstanceId: string }> {
    const root = this.restRoot();
    const url = `${root}/instances`;
    try {
      const resp = await firstValueFrom(
        this.http.post<Record<string, unknown>>(url, buf, {
          headers: {
            ...this.upstreamHeaders(),
            'Content-Type': 'application/dicom',
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          validateStatus: () => true,
        }),
      );
      if (resp.status !== 200) {
        this.logger.warn(
          JSON.stringify({
            event: 'orthanc.upload_error',
            status: resp.status,
            bodySnippet:
              typeof resp.data === 'object'
                ? JSON.stringify(resp.data).slice(0, 400)
                : String(resp.data).slice(0, 400),
          }),
        );
        throw new ServiceUnavailableException(
          `Orthanc recusou o objecto DICOM (HTTP ${resp.status}). Verifique sintaxe OU política ingest.`,
        );
      }
      const id = resp.data?.ID;
      if (typeof id !== 'string') {
        throw new ServiceUnavailableException(
          'Orthanc ingestão sem campo ID na resposta.',
        );
      }
      return { orthancInstanceId: id };
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      if (isAxiosError(e)) {
        throw new ServiceUnavailableException(
          'Sem ligação ao Orthanc durante upload DICOM.',
        );
      }
      throw e;
    }
  }

  /**
   * Elimina uma instância no Orthanc (ex.: PDF DOC gravado pela API).
   * Devolve false se o PACS respondeu erro (ex.: ID inexistente); não lança.
   */
  async tryDeleteOrthancInstance(orthancInstanceId: string): Promise<boolean> {
    const id = orthancInstanceId.trim();
    if (!id.length) return false;
    const root = this.restRoot();
    const url = `${root}/instances/${encodeURIComponent(id)}`;
    try {
      const resp = await firstValueFrom(
        this.http.delete(url, {
          headers: this.upstreamHeaders(),
          validateStatus: () => true,
        }),
      );
      if (resp.status === 200) return true;
      this.logger.warn(
        JSON.stringify({
          event: 'orthanc.delete_instance',
          id,
          status: resp.status,
        }),
      );
      return false;
    } catch (e) {
      this.logger.warn(
        JSON.stringify({
          event: 'orthanc.delete_instance_error',
          id,
          message: e instanceof Error ? e.message : String(e),
        }),
      );
      return false;
    }
  }
}
