/** Mínimo recomendado (evita tokens ultra-curtos por erro de config). */
export const JWT_EXPIRES_MIN_SEC = 300;

/** Máximo — sessões mais longas devem usar refresh / re-login explícito. */
export const JWT_EXPIRES_MAX_SEC = 604800;

/** ~8 h — alinhado ao comportamento anterior do projeto. */
export const JWT_EXPIRES_DEFAULT_SEC = 28_800;

/**
 * Resolve duração do JWT em segundos a partir de `JWT_EXPIRES_SEC`, com clamp seguro.
 */
export function resolveJwtExpiresSec(
  envVal: string | number | undefined | null,
): number {
  const n =
    typeof envVal === 'number'
      ? envVal
      : Number(typeof envVal === 'string' ? envVal.trim() : '');
  if (!Number.isFinite(n) || n <= 0) {
    return JWT_EXPIRES_DEFAULT_SEC;
  }
  const floor = Math.floor(n);
  return Math.min(
    JWT_EXPIRES_MAX_SEC,
    Math.max(JWT_EXPIRES_MIN_SEC, floor),
  );
}

/**
 * Indica se o valor de env foi alterado pelo clamp (para aviso no arranque).
 */
export function jwtExpiresWasClamped(
  envVal: string | undefined | null,
  resolved: number,
): boolean {
  if (envVal == null || String(envVal).trim() === '') return false;
  const n = Number(envVal);
  if (!Number.isFinite(n) || n <= 0) return false;
  return Math.floor(n) !== resolved;
}
