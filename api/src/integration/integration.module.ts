import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';

@Global()
@Module({
  imports: [
    HttpModule.register({
      timeout: 120_000,
      maxRedirects: 5,
    }),
  ],
  controllers: [IntegrationController],
  providers: [IntegrationService],
  exports: [IntegrationService],
})
export class IntegrationModule {}
