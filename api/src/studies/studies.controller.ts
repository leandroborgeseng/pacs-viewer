import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateStudyDto } from './dto/create-study.dto';
import { UpdateStudyDto } from './dto/update-study.dto';
import { StudiesService } from './studies.service';

@Controller('studies')
export class StudiesController {
  constructor(private studies: StudiesService) {}

  @Get('me/summary')
  summaryMine(@CurrentUser() user: RequestUser) {
    return this.studies.summaryForCurrentUser(user);
  }

  @Get('me')
  listMine(@CurrentUser() user: RequestUser) {
    return this.studies.listForCurrentUser(user);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  listAdmin() {
    return this.studies.listAllAdmin();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateStudyDto) {
    return this.studies.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateStudyDto) {
    return this.studies.update(id, dto);
  }

  /** ADMIN: URL do portal + registos institucionais de laudo PDF; tentativa de remoção no Orthanc quando conhecido. */
  @Delete(':id/report')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  deleteReportLaudo(@Param('id') id: string) {
    return this.studies.adminDeleteStudyLaudo(id);
  }
}
