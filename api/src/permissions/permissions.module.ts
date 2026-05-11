import { Module, forwardRef } from '@nestjs/common';
import { StudiesModule } from '../studies/studies.module';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

@Module({
  imports: [forwardRef(() => StudiesModule)],
  controllers: [PermissionsController],
  providers: [PermissionsService],
})
export class PermissionsModule {}
