import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { AuditService } from '../audit/audit.service';
import { resolveJwtExpiresSec } from '../common/jwt-expires';

export type AuthUserView = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  async validateCredentials(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email }});
    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return user;
  }

  async login(dto: LoginDto, ip?: string) {
    const user = await this.validateCredentials(dto.email, dto.password);
    const expiresSec = resolveJwtExpiresSec(this.config.get('JWT_EXPIRES_SEC'));
    const access_token = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      {
        expiresIn: expiresSec,
      },
    );
    await this.audit.log({
      userId: user.id,
      action: 'LOGIN',
      resource: 'auth',
      ip,
      metadata: { email: user.email },
    });
    return {
      access_token,
      expires_in: expiresSec,
      user: this.toView(user),
    };
  }

  async me(userId: string): Promise<AuthUserView> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active) {
      throw new UnauthorizedException();
    }
    return this.toView(user);
  }

  private toView(user: {
    id: string;
    email: string;
    name: string;
    role: Role;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
