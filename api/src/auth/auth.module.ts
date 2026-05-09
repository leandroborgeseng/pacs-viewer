import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { AuditModule } from '../audit/audit.module';
import {
  JWT_EXPIRES_MAX_SEC,
  JWT_EXPIRES_MIN_SEC,
  jwtExpiresWasClamped,
  resolveJwtExpiresSec,
} from '../common/jwt-expires';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const raw = config.get<string>('JWT_EXPIRES_SEC');
        const expiresIn = resolveJwtExpiresSec(raw);
        if (jwtExpiresWasClamped(raw, expiresIn)) {
          console.warn(
            `[auth] JWT_EXPIRES_SEC=${JSON.stringify(raw)} → clamp a ${expiresIn}s (permitido ${JWT_EXPIRES_MIN_SEC}–${JWT_EXPIRES_MAX_SEC}).`,
          );
        }
        return {
          secret: config.getOrThrow<string>('JWT_SECRET'),
          signOptions: { expiresIn },
        };
      },
    }),
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
