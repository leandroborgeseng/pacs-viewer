import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DicomAccessService } from '../dicom-web/dicom-access.service';
import { CreateStudyDto } from './dto/create-study.dto';
import { UpdateStudyDto } from './dto/update-study.dto';
import { RequestUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Injectable()
export class StudiesService {
  constructor(
    private prisma: PrismaService,
    private access: DicomAccessService,
  ) {}

  async listForCurrentUser(user: RequestUser) {
    const uids = await this.access.getAllowedStudyInstanceUIDs(user);
    if (user.role === Role.ADMIN) {
      return this.prisma.study.findMany({
        orderBy: { updatedAt: 'desc' },
        include: {
          patient: {
            select: { id: true, fullName: true, medicalRecordNumber: true },
          },
        },
      });
    }
    if (uids.size === 0) return [];
    return this.prisma.study.findMany({
      where: { studyInstanceUID: { in: [...uids] } },
      orderBy: { updatedAt: 'desc' },
      include: {
        patient: {
          select: { id: true, fullName: true, medicalRecordNumber: true },
        },
      },
    });
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
    return this.prisma.study.create({
      data: dto,
      include: { patient: true },
    });
  }

  async update(id: string, dto: UpdateStudyDto) {
    await this.ensureStudy(id);
    return this.prisma.study.update({
      where: { id },
      data: dto,
      include: { patient: true },
    });
  }

  private async ensureStudy(id: string) {
    const s = await this.prisma.study.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Estudo não encontrado');
    return s;
  }
}
