import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.patient.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, active: true } },
        _count: { select: { studies: true } },
      },
    });
  }

  async create(dto: CreatePatientDto) {
    const dup = await this.prisma.patient.findUnique({
      where: { medicalRecordNumber: dto.medicalRecordNumber },
    });
    if (dup) {
      throw new ConflictException('Prontuário já cadastrado');
    }
    return this.prisma.patient.create({ data: dto });
  }

  async update(id: string, dto: UpdatePatientDto) {
    await this.ensure(id);
    return this.prisma.patient.update({ where: { id }, data: dto });
  }

  private async ensure(id: string) {
    const p = await this.prisma.patient.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Paciente não encontrado');
    return p;
  }
}
