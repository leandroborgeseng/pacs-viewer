import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import dcmjs from 'dcmjs';
import { ConfigService } from '@nestjs/config';
import { OrthancRestClient } from '../dicom-web/orthanc-rest.client';
import { IntegrationService } from '../integration/integration.service';
import { StudiesService } from '../studies/studies.service';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { CreateLaudoPdfDto } from './dto/create-laudo-pdf.dto';
import { clinicalPdfTexts, renderLaudoPdfPdfkit } from './laudo-pdf.render';
import { naturalDatasetEncapsulatedPdf } from './encapsulated-pdf-dicom';
import { generateDicomUid } from '../common/utils/dicom-uid';

const datasetToBuffer = dcmjs.data.datasetToBuffer;

@Injectable()
export class ReportsPdfService {
  constructor(
    private readonly orthanc: OrthancRestClient,
    private readonly studies: StudiesService,
    private readonly config: ConfigService,
    private readonly integration: IntegrationService,
  ) {}

  async ingestSignedPdfReport(
    user: RequestUser,
    studyInstanceUid: string,
    dto: CreateLaudoPdfDto,
  ): Promise<{ orthancInstanceId: string; sopInstanceUid: string }> {
    if (
      user.role !== Role.MEDICO &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException(
        'Apenas perfil médico ou administrador pode gravar laudos PDF neste fluxo.',
      );
    }

    await this.studies.ensureAccess(user, studyInstanceUid);

    let orthancIds: string[];
    try {
      orthancIds =
        await this.orthanc.findStudiesByStudyInstanceUID(studyInstanceUid);
    } catch {
      throw new ServiceUnavailableException(
        'Não foi possível localizar o estudo no PACS (REST Orthanc). Verifique IP/porta e credenciais em Administração → Integração.',
      );
    }
    if (orthancIds.length === 0) {
      throw new NotFoundException(
        'Este StudyInstanceUID não existe no Orthanc ingestível por esta API.',
      );
    }

    const tags = await this.orthanc.getStudyClinicalTagsForLaudo(orthancIds[0]);
    const title =
      dto.title?.trim() ||
      `Laudo (${new Date().toLocaleDateString('pt-PT')})`;
    const tx = clinicalPdfTexts({
      title,
      body: dto.text.trim(),
      footer: `Gerado pelo portal institucional em ${new Date().toISOString()} | ${user.email}`,
    });
    let pdfBuf: Buffer;
    try {
      pdfBuf = await renderLaudoPdfPdfkit(tx);
    } catch {
      throw new ServiceUnavailableException(
        'Falha ao gerar o PDF do laudo (servidor).',
      );
    }

    const sopInstanceUid = generateDicomUid();
    const seriesInstanceUid = generateDicomUid();
    const rCfg = this.integration.resolved;
    const manufacturer =
      rCfg.laudoManufacturer?.trim() ??
      this.config.get<string>('LAUDO_DICOM_MANUFACTURER')?.trim() ??
      'BlueBeaver Portal';
    const seriesNumberRaw =
      rCfg.laudoSeriesNumber?.trim() ??
      this.config.get<string>('LAUDO_SERIES_NUMBER')?.trim() ??
      '999';
    const seriesNumberStr =
      /^-?\d+$/.test(seriesNumberRaw) ? seriesNumberRaw : '999';

    const natural = naturalDatasetEncapsulatedPdf(tags, {
      pdfBuffer: pdfBuf,
      sopInstanceUid,
      seriesInstanceUid,
      seriesDescription: title.slice(0, 64),
      seriesNumberStr,
      manufacturer,
    });

    let buf: Buffer;
    try {
      buf = datasetToBuffer(natural);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Dataset DICOM encapsulador inválido.';
      throw new ServiceUnavailableException(
        `Empacotamento DICOM falhou: ${msg}`,
      );
    }

    try {
      const { orthancInstanceId } =
        await this.orthanc.uploadDicom(buf);
      this.studies.invalidateStudyCatalogCache();
      return { orthancInstanceId, sopInstanceUid };
    } catch (e) {
      if (
        e instanceof ServiceUnavailableException ||
        e instanceof NotFoundException
      ) {
        throw e;
      }
      throw new ServiceUnavailableException(
        'Upload ao Orthanc falhou por motivo não previsto.',
      );
    }
  }
}
