import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class DicomAccessService {
  private readonly allowlistCacheTtlMs: number;
  /** Conjuntos de StudyInstanceUID permitidos ao utilizador (proxy OHIF faz muitos pedidos). */
  private readonly allowlistCache = new Map<
    string,
    { expiresAt: number; uids: Set<string> }
  >();

  constructor(
    private prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const raw = config.get<string | undefined>('ACCESS_ALLOWLIST_CACHE_MS');
    const n = parseInt(String(raw ?? '25000'), 10);
    this.allowlistCacheTtlMs =
      Number.isFinite(n) && n >= 0 ? n : 25000;
  }

  /** Após permissões ou estudos no portal alterarem RBAC para um utilizador. */
  invalidateAllowlistCache(): void {
    this.allowlistCache.clear();
  }

  async getAllowedStudyInstanceUIDs(user: RequestUser): Promise<Set<string>> {
    const load = (): Promise<Set<string>> => this.fetchAllowedStudyInstanceUIDsFresh(user);

    if (this.allowlistCacheTtlMs <= 0) {
      return load();
    }
    const key = `${user.sub}:${user.role}`;
    const now = Date.now();
    const hit = this.allowlistCache.get(key);
    if (hit && hit.expiresAt > now) {
      return new Set(hit.uids);
    }
    const uids = await load();
    this.allowlistCache.set(key, {
      expiresAt: now + this.allowlistCacheTtlMs,
      uids,
    });
    return new Set(uids);
  }

  private async fetchAllowedStudyInstanceUIDsFresh(
    user: RequestUser,
  ): Promise<Set<string>> {
    if (user.role === Role.ADMIN) {
      const rows = await this.prisma.study.findMany({
        select: { studyInstanceUID: true },
      });
      return new Set(rows.map((r) => r.studyInstanceUID));
    }
    if (user.role === Role.PACIENTE) {
      const patient = await this.prisma.patient.findFirst({
        where: { userId: user.sub },
        include: { studies: { select: { studyInstanceUID: true } } },
      });
      return new Set(patient?.studies.map((s) => s.studyInstanceUID) ?? []);
    }
    const permissions = await this.prisma.studyPermission.findMany({
      where: { userId: user.sub },
      include: { study: { select: { studyInstanceUID: true } } },
    });
    return new Set(permissions.map((p) => p.study.studyInstanceUID));
  }

  async canAccessStudy(
    user: RequestUser,
    studyInstanceUID: string,
  ): Promise<boolean> {
    if (user.role === Role.ADMIN) return true;
    const allowed = await this.getAllowedStudyInstanceUIDs(user);
    return allowed.has(studyInstanceUID);
  }
}
