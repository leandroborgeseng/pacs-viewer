import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { AuditService } from './audit.service';

/** Operações sensíveis (mutações REST) já são registadas pelo `AuditInterceptor`, exceto login e `/dicomweb`. */
@Controller('audit')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get('logs')
  logs(@Query() q: AuditLogQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    return this.audit.listLogs({
      page,
      pageSize,
      action: q.action?.trim(),
      userId: q.userId?.trim(),
      from: q.from?.trim(),
      to: q.to?.trim(),
    });
  }
}
