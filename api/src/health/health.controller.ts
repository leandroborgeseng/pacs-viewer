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

/** Resposta útil em GET /api (não confundir com a raiz do site, que é só JSON). */
@SkipThrottle()
@Controller()
export class ApiRootController {
  @Public()
  @Get()
  apiRoot() {
    return {
      service: 'pacs-viewer-api',
      message:
        'REST sob este prefixo. Ex.: POST /api/auth/login, GET /api/auth/me, GET /api/studies/me',
      health: '/health',
      healthz: '/healthz',
    };
  }
}
