import {
  Controller,
  Body,
  Param,
  Post,
  Get,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateLaudoPdfDto } from './dto/create-laudo-pdf.dto';
import {
  ReportsPdfService,
  type ReportLaudoVerifyResponse,
} from './reports-pdf.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsPdf: ReportsPdfService) {}

  @Public()
  @Get('laudos/verify/:verifyCode')
  verifyLaudoSeal(
    @Param('verifyCode') verifyCode: string,
  ): Promise<ReportLaudoVerifyResponse> {
    return this.reportsPdf.lookupLaudoSeal(verifyCode ?? '');
  }

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
