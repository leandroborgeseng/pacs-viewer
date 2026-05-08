import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { AuditService } from './audit.service';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { RequestUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private audit: AuditService,
    private reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<{
      method: string;
      path: string;
      originalUrl: string;
      ip?: string;
      user?: RequestUser;
    }>();
    if (isPublic || !['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      return next.handle();
    }
    if (req.originalUrl.includes('/auth/login')) {
      return next.handle();
    }
    if (req.originalUrl.includes('/dicomweb')) {
      return next.handle();
    }
    return next.handle().pipe(
      tap({
        next: () => {
          void this.audit.log({
            userId: req.user?.sub,
            action: `${req.method} ${req.originalUrl}`,
            resource: req.originalUrl,
            ip: req.ip,
          });
        },
      }),
    );
  }
}
