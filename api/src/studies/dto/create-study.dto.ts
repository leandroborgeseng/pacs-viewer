import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateStudyDto {
  @IsString()
  patientId!: string;

  /// UID DICOM do estudo (deve existir no Orthanc após ingestão)
  @IsString()
  @Matches(/^[0-9.]+$/)
  studyInstanceUID!: string;

  @IsOptional()
  @IsString()
  studyDescription?: string;

  @IsOptional()
  @IsString()
  studyDate?: string;

  @IsOptional()
  @IsString()
  accessionNumber?: string;

  @IsOptional()
  @IsString()
  modality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  reportUrl?: string;
}
