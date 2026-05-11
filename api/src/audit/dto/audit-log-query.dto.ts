import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

function intOr(
  value: unknown,
  fallback: number,
  opts: { min: number; max?: number },
): number {
  if (value === undefined || value === null || value === '')
    return fallback;
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  let v = Math.max(opts.min, n);
  if (opts.max !== undefined) v = Math.min(opts.max, v);
  return v;
}

/** Query para `GET /audit/logs`. */
export class AuditLogQueryDto {
  @IsOptional()
  @Transform(({ value }) => intOr(value, 1, { min: 1 }))
  @IsInt()
  @Min(1)
  page!: number;

  @IsOptional()
  @Transform(({ value }) => intOr(value, 25, { min: 1, max: 100 }))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;

  /** Limite inferior da data ISO (yyyy-mm-dd ou completo UTC). */
  @IsOptional()
  @IsString()
  @MaxLength(36)
  from?: string;

  /** Limite superior da data ISO. */
  @IsOptional()
  @IsString()
  @MaxLength(36)
  to?: string;
}
