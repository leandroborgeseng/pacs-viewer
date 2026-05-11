import { All, Controller, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { DicomWebService } from './dicom-web.service';

/** OHIF faz dezenas ou centenas de GET por estudo — limite mais alto que o throttler global da app. */
@Throttle({ default: { limit: 3500, ttl: 60_000 } })
@Controller('dicomweb')
export class DicomWebController {
  constructor(private dicom: DicomWebService) {}

  @All('*')
  async proxy(
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser() user: RequestUser,
  ) {
    await this.dicom.proxy(req, res, user);
  }
}
