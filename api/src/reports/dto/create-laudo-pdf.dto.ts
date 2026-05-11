import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateLaudoPdfDto {
  @IsString()
  @MinLength(1, { message: 'Texto do laudo obrigatório.' })
  @MaxLength(50_000, { message: 'Texto do laudo demasiado longo.' })
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Título demasiado longo.' })
  title?: string;
}
