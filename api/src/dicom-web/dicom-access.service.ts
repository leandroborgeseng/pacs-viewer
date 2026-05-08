import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class DicomAccessService {
  constructor(private prisma: PrismaService) {}

  async getAllowedStudyInstanceUIDs(user: RequestUser): Promise<Set<string>> {
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
    const allowed = await this.getAllowedStudyInstanceUIDs(user);
    return allowed.has(studyInstanceUID);
  }
}
