import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok' };
  }
}

@Controller('healthz')
export class HealthzController {
  @Public()
  @Get()
  check() {
    return { status: 'ok' };
  }
}
