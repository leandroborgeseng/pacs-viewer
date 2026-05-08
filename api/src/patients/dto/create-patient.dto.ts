import { IsDate, IsOptional, IsString, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePatientDto {
  @IsString()
  @Matches(/^[A-Z0-9._-]+$/i)
  medicalRecordNumber!: string;

  @IsString()
  fullName!: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  birthDate?: Date;
}
