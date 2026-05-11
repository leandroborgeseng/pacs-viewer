import { Controller, Body, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateLaudoPdfDto } from './dto/create-laudo-pdf.dto';
import { ReportsPdfService } from './reports-pdf.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsPdf: ReportsPdfService) {}

  @Post('studies/:studyInstanceUid/pdf')
  @UseGuards(RolesGuard)
  @Roles(Role.MEDICO, Role.ADMIN)
  ingestLaudoPdf(
    @CurrentUser() user: RequestUser,
    @Param('studyInstanceUid') studyInstanceUid: string,
    @Body() dto: CreateLaudoPdfDto,
  ) {
    return this.reportsPdf.ingestSignedPdfReport(
      user,
      decodeURIComponent(studyInstanceUid),
      dto,
    );
  }
}
