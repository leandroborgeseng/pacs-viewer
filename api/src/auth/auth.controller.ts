import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  resolvedLoginThrottleLimit,
  resolvedLoginThrottleTtlMs,
} from './auth-login-throttle.constants';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import type { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Get('login')
  loginHint() {
    return {
      message:
        'Use POST com Content-Type: application/json e corpo { "email", "password" }. Abrir esta URL no navegador (GET) não faz login.',
      method: 'POST',
      path: '/api/auth/login',
    };
  }

  @Public()
  @Throttle({
    default: {
      ttl: resolvedLoginThrottleTtlMs(),
      limit: resolvedLoginThrottleLimit(),
    },
  })
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = req.ip;
    return this.auth.login(dto, ip);
  }

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.sub);
  }
}
