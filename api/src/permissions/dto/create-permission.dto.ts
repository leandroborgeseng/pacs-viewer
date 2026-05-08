import { IsUUID } from 'class-validator';

export class CreatePermissionDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  studyId!: string;
}
