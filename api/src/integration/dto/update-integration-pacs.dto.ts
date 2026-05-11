import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Corpo PATCH — campos omitidos não alteram a base de dados. */
export class UpdateIntegrationPacsDto {
  @IsOptional()
  @IsBoolean()
  orthancUseTls?: boolean;

  /** Sem propriedade = não muda; string vazia = apagar IP/host (voltar só ao .env). */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  orthancHost?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  orthancPort?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Matches(/^\/.{0,248}$/, {
    message:
      'orthancDicomWebPath deve começar por / e ser relativamente curto (ex.: /dicom-web).',
  })
  orthancDicomWebPath?: string;

  /** Sem propriedade = não muda; string vazia = credencial em branco quando o modo BD está activo. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  orthancUsername?: string;

  /** Se definido e não vazio (após trim), define nova palavra-passe. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  orthancPasswordNew?: string;

  @IsOptional()
  @IsBoolean()
  clearStoredOrthancPassword?: boolean;

  /** URL pública do portal (HTTPS). Vazio para apagar campo na BD e usar só WEB_ORIGIN. */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  webOriginPublic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  laudoManufacturer?: string;

  /** Ex.: \"999\". Vazio para apagar campo na BD. */
  @IsOptional()
  @IsString()
  @MaxLength(16)
  laudoSeriesNumber?: string;

  @IsOptional()
  @IsBoolean()
  dicomProxyDebug?: boolean;
}
