import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DicomAccessService } from '../dicom-web/dicom-access.service';
import { OrthancDicomWebClient } from '../dicom-web/orthanc-dicomweb.client';
import { CreateStudyDto } from './dto/create-study.dto';
import { UpdateStudyDto } from './dto/update-study.dto';
import { RequestUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { StudyCatalogRow, StudyCatalogSummary } from './study-catalog.types';
import { buildStudyCatalogSummary } from './study-catalog-summary';

export type { StudyCatalogRow, StudyCatalogSummary } from './study-catalog.types';

const TAG_STUDY_UID = '0020000D';
const TAG_STUDY_DATE = '00080020';
const TAG_STUDY_DESC = '00081030';
const TAG_MODALITIES = '00080061';
const TAG_PATIENT_NAME = '00100010';
const TAG_PATIENT_ID = '00100020';
/** Number of Study Related Series (IS) — metadados no nível study (Orthanc). */
const TAG_NUM_SERIES = '00201206';
/** Number of Study Related Instances (IS) — contagem Orthanc quando disponível. */
const TAG_NUM_INSTANCES = '00201208';

@Injectable()
export class StudiesService {
  private readonly catalogCacheTtlMs: number;

  /** Resposta já filtrada/ordenada/merge ao portal por utilizador JWT. */
  private readonly catalogCache = new Map<
    string,
    { expiresAt: number; rows: StudyCatalogRow[] }
  >();

  constructor(
    private prisma: PrismaService,
    private access: DicomAccessService,
    private orthanc: OrthancDicomWebClient,
    configService: ConfigService,
  ) {
    const raw = configService.get<string | undefined>('STUDIES_CATALOG_CACHE_MS');
    const n = parseInt(String(raw ?? '45000'), 10);
    this.catalogCacheTtlMs =
      Number.isFinite(n) && n >= 0 ? n : 45000;
  }

  /** Limpa o cache QIDO+RBAC+merge ao portal por utilizador (permissões ou mutação em Study). */
  invalidateStudyCatalogCache(): void {
    this.catalogCache.clear();
  }

  /**
   * Catálogo de exames: QIDO no PACS (Orthanc), filtrado por RBAC na API.
   * ADMIN vê todos os estudos no PACS; MEDICO/PACIENTE só UIDs autorizados na BD.
   */

  async listForCurrentUser(user: RequestUser): Promise<StudyCatalogRow[]> {
    if (this.catalogCacheTtlMs <= 0) {
      return this.computeFreshListForCurrentUser(user);
    }
    const cacheKey = `${user.sub}:${user.role}`;
    const now = Date.now();
    const hit = this.catalogCache.get(cacheKey);
    if (hit && hit.expiresAt > now) {
      return hit.rows;
    }

    const rows = await this.computeFreshListForCurrentUser(user);
    this.catalogCache.set(cacheKey, {
      expiresAt: now + this.catalogCacheTtlMs,
      rows,
    });
    return rows;
  }

  /**
   * Resumo do catálogo visível ao utilizador — reaproveita o cache de `listForCurrentUser`.
   */
  async summaryForCurrentUser(user: RequestUser): Promise<StudyCatalogSummary> {
    const rows = await this.listForCurrentUser(user);
    return buildStudyCatalogSummary(rows);
  }

  private async computeFreshListForCurrentUser(user: RequestUser): Promise<StudyCatalogRow[]> {
    const raw = await this.orthanc.fetchStudiesDicomJson();
    const rows = raw
      .map((item) => this.mapDicomStudyToRow(item))
      .filter((r): r is NonNullable<typeof r> => r != null);

    let scoped: StudyCatalogRow[];
    if (user.role === Role.ADMIN) {
      scoped = rows;
    } else {
      const allowed = await this.access.getAllowedStudyInstanceUIDs(user);
      if (allowed.size === 0) return [];
      scoped = rows.filter((r) => allowed.has(r.studyInstanceUID));
    }

    const merged = await this.mergePortalStudyExtras(scoped);
    return this.sortStudyRows(merged);
  }

  /** Junta dados do portal (`Study.reportUrl`) ao catálogo PACS pela StudyInstanceUID. */
  private async mergePortalStudyExtras(rows: StudyCatalogRow[]): Promise<StudyCatalogRow[]> {
    if (rows.length === 0) return rows;
    const uids = [...new Set(rows.map((r) => r.studyInstanceUID))];
    const extras = await this.prisma.study.findMany({
      where: { studyInstanceUID: { in: uids } },
      select: { studyInstanceUID: true, reportUrl: true },
    });
    const map = new Map(extras.map((e) => [e.studyInstanceUID, e.reportUrl]));
    return rows.map((r) => ({
      ...r,
      reportUrl: map.get(r.studyInstanceUID) ?? null,
    }));
  }

  listAllAdmin() {
    return this.prisma.study.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        patient: true,
        _count: { select: { permissions: true } },
      },
    });
  }

  async ensureAccess(user: RequestUser, studyInstanceUID: string) {
    const ok = await this.access.canAccessStudy(user, studyInstanceUID);
    if (!ok) {
      throw new ForbiddenException('Sem acesso a este estudo');
    }
  }

  async create(dto: CreateStudyDto) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
    });
    if (!patient) throw new NotFoundException('Paciente não encontrado');
    const row = await this.prisma.study.create({
      data: dto,
      include: { patient: true },
    });
    this.invalidateStudyCatalogCache();
    return row;
  }

  async update(id: string, dto: UpdateStudyDto) {
    await this.ensureStudy(id);
    let data = { ...(dto as object) } as Prisma.StudyUpdateInput & { reportUrl?: string | null };
    if (dto.reportUrl !== undefined) {
      const trimmed = dto.reportUrl?.trim() ?? '';
      data = { ...data, reportUrl: trimmed.length > 0 ? trimmed : null };
    }
    const row = await this.prisma.study.update({
      where: { id },
      data,
      include: {
        patient: true,
        _count: { select: { permissions: true } },
      },
    });
    this.invalidateStudyCatalogCache();
    return row;
  }

  private async ensureStudy(id: string) {
    const s = await this.prisma.study.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Estudo não encontrado');
    return s;
  }

  private sortStudyRows<T extends { studyDate: string | null; studyInstanceUID: string }>(
    rows: T[],
  ): T[] {
    return [...rows].sort((a, b) => {
      const da = a.studyDate ?? '';
      const db = b.studyDate ?? '';
      if (da !== db) return db.localeCompare(da);
      return b.studyInstanceUID.localeCompare(a.studyInstanceUID);
    });
  }

  private mapDicomStudyToRow(item: unknown): StudyCatalogRow | null {
    const uid = this.readUiString(item, TAG_STUDY_UID);
    if (!uid) return null;

    const mrn = this.readFirstString(item, TAG_PATIENT_ID) ?? '';
    const fullName = this.readPersonName(item, TAG_PATIENT_NAME);
    const patientId =
      mrn.length > 0 ? `pacs:${mrn}` : `pacs:study:${uid.slice(0, 24)}`;

    return {
      id: uid,
      studyInstanceUID: uid,
      studyDescription: this.readFirstString(item, TAG_STUDY_DESC),
      studyDate: this.readFirstString(item, TAG_STUDY_DATE),
      modality: this.joinModality(item, TAG_MODALITIES),
      seriesCount: this.readFirstNonNegativeInt(item, TAG_NUM_SERIES),
      instanceCount: this.readFirstNonNegativeInt(item, TAG_NUM_INSTANCES),
      reportUrl: null,
      patient: {
        id: patientId,
        fullName: fullName,
        medicalRecordNumber: mrn || '—',
      },
    };
  }

  private readUiString(item: unknown, tag: string): string | null {
    if (!item || typeof item !== 'object') return null;
    const t = (item as Record<string, { Value?: unknown[] } | undefined>)[tag];
    const v = t?.Value?.[0];
    return typeof v === 'string' && v.length > 0 ? v : null;
  }

  private readFirstString(item: unknown, tag: string): string | null {
    if (!item || typeof item !== 'object') return null;
    const t = (item as Record<string, { Value?: unknown[] } | undefined>)[tag];
    const v = t?.Value?.[0];
    if (typeof v === 'string' && v.length > 0) return v;
    return null;
  }

  private readPersonName(item: unknown, tag: string): string {
    if (!item || typeof item !== 'object') return '—';
    const t = (item as Record<string, { Value?: unknown[] } | undefined>)[tag];
    const v = t?.Value?.[0];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (v && typeof v === 'object' && 'Alphabetic' in v) {
      const a = (v as { Alphabetic?: string }).Alphabetic;
      if (typeof a === 'string' && a.trim()) return a.trim();
    }
    return '—';
  }

  private joinModality(item: unknown, tag: string): string | null {
    if (!item || typeof item !== 'object') return null;
    const t = (item as Record<string, { Value?: unknown[] } | undefined>)[tag];
    const vals = t?.Value;
    if (!Array.isArray(vals) || vals.length === 0) return null;
    const parts = vals.filter((x): x is string => typeof x === 'string' && x.length > 0);
    return parts.length ? parts.join('\\') : null;
  }

  private readFirstNonNegativeInt(item: unknown, tag: string): number | null {
    if (!item || typeof item !== 'object') return null;
    const t = (item as Record<string, { Value?: unknown[] } | undefined>)[tag];
    const v = t?.Value?.[0];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.floor(v);
    if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) {
      const n = Number.parseInt(v, 10);
      return Number.isFinite(n) && n >= 0 ? n : null;
    }
    return null;
  }
}
