import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';

@SkipThrottle()
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok' };
  }
}

@SkipThrottle()
@Controller('healthz')
export class HealthzController {
  @Public()
  @Get()
  check() {
    return { status: 'ok' };
  }
}
