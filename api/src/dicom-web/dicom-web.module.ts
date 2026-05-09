import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DicomWebController } from './dicom-web.controller';
import { DicomWebService } from './dicom-web.service';
import { DicomAccessService } from './dicom-access.service';
import { OrthancDicomWebClient } from './orthanc-dicomweb.client';

@Module({
  imports: [
    HttpModule.register({
      timeout: 120_000,
      maxRedirects: 5,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    }),
  ],
  controllers: [DicomWebController],
  providers: [DicomWebService, DicomAccessService, OrthancDicomWebClient],
  exports: [DicomAccessService, OrthancDicomWebClient],
})
export class DicomWebModule {}
