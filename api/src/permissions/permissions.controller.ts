import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { PermissionsService } from './permissions.service';

@Controller('permissions')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class PermissionsController {
  constructor(private permissions: PermissionsService) {}

  @Get()
  list() {
    return this.permissions.list();
  }

  @Post()
  create(@Body() dto: CreatePermissionDto) {
    return this.permissions.create(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.permissions.remove(id);
  }
}
