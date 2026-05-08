import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { DicomWebService } from './dicom-web.service';

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
