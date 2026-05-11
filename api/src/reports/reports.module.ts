import { Module } from '@nestjs/common';
import { StudiesModule } from '../studies/studies.module';
import { DicomWebModule } from '../dicom-web/dicom-web.module';
import { ReportsController } from './reports.controller';
import { ReportsPdfService } from './reports-pdf.service';

@Module({
  imports: [StudiesModule, DicomWebModule],
  controllers: [ReportsController],
  providers: [ReportsPdfService],
})
export class ReportsModule {}
