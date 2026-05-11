import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { createHash } from 'node:crypto';
import dcmjs from 'dcmjs';
import { ConfigService } from '@nestjs/config';
import { OrthancRestClient } from '../dicom-web/orthanc-rest.client';
import { IntegrationService } from '../integration/integration.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudiesService } from '../studies/studies.service';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { CreateLaudoPdfDto } from './dto/create-laudo-pdf.dto';
import {
  asciiClinicalText,
  clinicalPdfTexts,
  renderLaudoPdfPdfkit,
} from './laudo-pdf.render';
import { computeLaudoSeal, generateVerifyCodeHex, verifyLaudoSealMac } from './laudo-seal';
import { naturalDatasetEncapsulatedPdf } from './encapsulated-pdf-dicom';
import { generateDicomUid } from '../common/utils/dicom-uid';
import { splitWebOrigins } from '../integration/integration.service';

const datasetToBuffer = dcmjs.data.datasetToBuffer;

/**
 * Lookup público: devolve apenas metadados não sensíveis (não há PDF na resposta).
 */
export type ReportLaudoVerifyResponse = {
  known: boolean;
  /** Servidor conseguiu revalidar o HMAC gravado na base. */
  cryptographicIntegrity: boolean;
  studyInstanceUid?: string;
  sopInstanceUid?: string;
  issuedAtUtc?: string;
  issuerEmailMasked?: string;
  pdfBinarySha256Short?: string;
};

function maskEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.indexOf('@');
  if (at < 1) return '***';
  const user = e.slice(0, at);
  const dom = e.slice(at + 1);
  const pre = user.length <= 2 ? user[0] ?? '*' : `${user.slice(0, 2)}`;
  return `${pre}***@${dom}`;
}

@Injectable()
export class ReportsPdfService {
  private readonly logger = new Logger(ReportsPdfService.name);

  constructor(
    private readonly orthanc: OrthancRestClient,
    private readonly studies: StudiesService,
    private readonly config: ConfigService,
    private readonly integration: IntegrationService,
    private readonly prisma: PrismaService,
  ) {}

  private sealSecret(): string {
    const custom = this.config.get<string>('LAUDO_SEAL_SECRET')?.trim();
    if (custom) return custom;
    const jwt = this.config.get<string>('JWT_SECRET');
    const j = jwt?.trim();
    if (!j) {
      throw new ServiceUnavailableException(
        'Segredo LAUDO_SEAL_SECRET ou JWT_SECRET em falta para selo dos laudos.',
      );
    }
    return j;
  }

  private portalOriginForLinks(): string {
    const fromDb =
      this.integration.resolved.webOriginPublic?.trim().replace(/\/+$/, '') ??
      '';
    if (fromDb) return fromDb;
    const fromEnv =
      splitWebOrigins(this.config.get<string>('WEB_ORIGIN'))[0] ?? '';
    if (fromEnv) return fromEnv.replace(/\/+$/, '');
    return 'http://localhost:3000';
  }

  async lookupLaudoSeal(verifyCodeRaw: string): Promise<ReportLaudoVerifyResponse> {
    const verifyCode = verifyCodeRaw.trim().toLowerCase().replace(/^0x/, '');
    if (!/^[a-f0-9]{32}$/.test(verifyCode)) {
      throw new NotFoundException('Codigo de verificação inválido.');
    }
    const row = await this.prisma.reportLaudoSeal.findUnique({
      where: { verifyCode },
    });
    if (!row) {
      throw new NotFoundException('Este codigo de verificação não foi encontrado.');
    }
    const secret = this.sealSecret();
    const cryptoOk = verifyLaudoSealMac(
      secret,
      row.canonicalPayload,
      row.sealMacHex,
    );
    return {
      known: true,
      cryptographicIntegrity: cryptoOk,
      studyInstanceUid: row.studyInstanceUid,
      sopInstanceUid: row.sopInstanceUid,
      issuedAtUtc: row.createdAt.toISOString(),
      issuerEmailMasked: maskEmail(row.issuerEmail),
      pdfBinarySha256Short:
        row.pdfBinarySha256Hex.length >= 16
          ? `${row.pdfBinarySha256Hex.slice(0, 16)}…`
          : row.pdfBinarySha256Hex,
    };
  }

  async ingestSignedPdfReport(
    user: RequestUser,
    studyInstanceUid: string,
    dto: CreateLaudoPdfDto,
  ): Promise<{
    orthancInstanceId: string;
    sopInstanceUid: string;
    verifyCode: string;
    verificationUrl: string;
  }> {
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
    const bodyRaw = dto.text.trim();

    const issuedAtIso = new Date().toISOString();
    const sopInstanceUid = generateDicomUid();
    const verifyCode = await this.allocateVerifyCodeHex();
    const secret = this.sealSecret();

    const titlePrinted = asciiClinicalText(title.trim() || '(sem título)');
    const bodyPrinted = asciiClinicalText(bodyRaw || '');
    const seal = computeLaudoSeal({
      secret,
      titlePrintedAscii: titlePrinted,
      bodyPrintedAscii: bodyPrinted,
      studyInstanceUid,
      issuerUserSub: user.sub,
      issuerEmail: user.email,
      sopInstanceUid,
      issuedAtIsoUtc: issuedAtIso,
      verifyCode,
    });

    const origin = this.portalOriginForLinks();
    const verificationUrl = `${origin}/verificar-laudo?c=${verifyCode}`;
    const baseFooterLines = [
      `Gerado pelo portal institucional em ${issuedAtIso} | ${user.email}`,
      verificationUrl,
      `Codigo verificacao (sem tracos): ${verifyCode}`,
      `Corpo texto (digesto SHA-256): ${createHash('sha256').update(bodyPrinted, 'utf8').digest('hex').slice(0, 20)}…`,
      `Selo institucional (HMAC SHA-256, prefixo): ${seal.sealMacHex.slice(0, 24)}…`,
    ];

    const tx = clinicalPdfTexts({
      title,
      body: bodyRaw || '',
      footer: baseFooterLines.join('\n'),
    });

    let pdfBuf: Buffer;
    try {
      pdfBuf = await renderLaudoPdfPdfkit(tx);
    } catch {
      throw new ServiceUnavailableException(
        'Falha ao gerar o PDF do laudo (servidor).',
      );
    }

    const pdfBinarySha256Hex = createHash('sha256')
      .update(pdfBuf)
      .digest('hex');

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

    let orthancInstanceId: string;
    try {
      const up = await this.orthanc.uploadDicom(buf);
      orthancInstanceId = up.orthancInstanceId;
      this.studies.invalidateStudyCatalogCache();
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

    try {
      await this.prisma.reportLaudoSeal.create({
        data: {
          verifyCode,
          studyInstanceUid,
          sopInstanceUid,
          issuerUserId: user.sub,
          issuerEmail: user.email.trim().toLowerCase(),
          canonicalPayload: seal.canonicalPayload,
          sealMacHex: seal.sealMacHex,
          pdfBinarySha256Hex,
          orthancInstanceId,
        },
      });
    } catch (err) {
      this.logger.error(
        JSON.stringify({
          event: 'report_laudo_seal.persist_failed',
          verifyCode,
          studyInstanceUid,
          sopInstanceUid,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }

    return {
      orthancInstanceId,
      sopInstanceUid,
      verifyCode,
      verificationUrl,
    };
  }

  /** Poucas tentativas se colidir (probabilidade desprezável). */
  private async allocateVerifyCodeHex(maxAttempts = 8): Promise<string> {
    for (let i = 0; i < maxAttempts; i += 1) {
      const code = generateVerifyCodeHex().toLowerCase();
      const hit = await this.prisma.reportLaudoSeal.findUnique({
        where: { verifyCode: code },
      });
      if (!hit) return code;
    }
    throw new ServiceUnavailableException(
      'Não foi possível gerar código de verificação único.',
    );
  }
}
