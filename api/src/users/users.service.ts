import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
        patientProfile: { select: { id: true, medicalRecordNumber: true } },
      },
    });
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) {
      throw new ConflictException('E-mail já cadastrado');
    }
    if (dto.role === Role.PACIENTE && dto.patientId) {
      const patient = await this.prisma.patient.findUnique({
        where: { id: dto.patientId },
      });
      if (!patient) {
        throw new NotFoundException('Paciente não encontrado');
      }
      if (patient.userId) {
        throw new ConflictException('Paciente já vinculado a outro usuário');
      }
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const { patientId, ...rest } = dto;
    const user = await this.prisma.user.create({
      data: {
        email: rest.email,
        name: rest.name,
        role: rest.role,
        passwordHash,
      },
    });
    if (dto.role === Role.PACIENTE && patientId) {
      await this.prisma.patient.update({
        where: { id: patientId },
        data: { userId: user.id },
      });
    }
    return this.findOneSafe(user.id);
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.ensureUser(id);
    const data: {
      email?: string;
      name?: string;
      role?: Role;
      active?: boolean;
      passwordHash?: string;
    } = {};
    if (dto.email) data.email = dto.email;
    if (dto.name) data.name = dto.name;
    if (dto.role) data.role = dto.role;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    await this.prisma.user.update({ where: { id }, data });
    return this.findOneSafe(id);
  }

  private async ensureUser(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return u;
  }

  private findOneSafe(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
        patientProfile: { select: { id: true, medicalRecordNumber: true } },
      },
    });
  }
}
