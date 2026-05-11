import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DicomWebController } from './dicom-web.controller';
import { DicomWebService } from './dicom-web.service';
import { DicomAccessService } from './dicom-access.service';
import { OrthancDicomWebClient } from './orthanc-dicomweb.client';
import { OrthancRestClient } from './orthanc-rest.client';

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
  providers: [DicomWebService, DicomAccessService, OrthancDicomWebClient, OrthancRestClient],
  exports: [DicomAccessService, OrthancDicomWebClient, OrthancRestClient],
})
export class DicomWebModule {}
