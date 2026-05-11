import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { StudiesService } from '../studies/studies.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePermissionDto } from './dto/create-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => StudiesService))
    private readonly studiesService: StudiesService,
  ) {}

  list() {
    return this.prisma.studyPermission.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true, role: true } },
        study: {
          select: {
            id: true,
            studyInstanceUID: true,
            studyDescription: true,
            patient: { select: { fullName: true, medicalRecordNumber: true } },
          },
        },
      },
    });
  }

  async create(dto: CreatePermissionDto) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user?.active) throw new NotFoundException('Usuário não encontrado');
    if (user.role !== Role.MEDICO) {
      throw new ConflictException(
        'Apenas perfil MEDICO pode receber permissão explícita de estudo',
      );
    }
    const study = await this.prisma.study.findUnique({
      where: { id: dto.studyId },
    });
    if (!study) throw new NotFoundException('Estudo não encontrado');
    try {
      const permission = await this.prisma.studyPermission.create({
        data: dto,
        include: {
          user: { select: { id: true, email: true, name: true } },
          study: { select: { id: true, studyInstanceUID: true } },
        },
      });
      this.studiesService.invalidateStudyCatalogCache();
      return permission;
    } catch {
      throw new ConflictException('Permissão já existente para este par usuário/estudo');
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.studyPermission.delete({ where: { id } });
    } catch {
      throw new NotFoundException('Permissão não encontrada');
    }
    this.studiesService.invalidateStudyCatalogCache();
    return { ok: true };
  }
}
