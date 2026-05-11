import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateIntegrationPacsDto } from './dto/update-integration-pacs.dto';
import { IntegrationService } from './integration.service';

@Controller('integration')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class IntegrationController {
  constructor(private readonly integration: IntegrationService) {}

  @Get('pacs')
  getPacs() {
    return this.integration.getPacsAdminView();
  }

  @Patch('pacs')
  patchPacs(@Body() dto: UpdateIntegrationPacsDto) {
    return this.integration.applyPatch(dto);
  }

  /** Testa Orthanc REST `GET /system` com a mesma URL e credencial efectiva da API. */
  @Post('pacs/test')
  testPacs() {
    return this.integration.testOrthancConnectivity();
  }
}
