/**
 * Limitação de fluxo própria do login (REST `POST …/auth/login`), mais estrita que o throttler global.
 * Variáveis lidas na inicialização do processo (ConfigService não executa em tempo de decorator).
 */

export function resolvedLoginThrottleLimit(): number {
  const n = Number.parseInt(process.env.AUTH_LOGIN_THROTTLE_LIMIT ?? '20', 10);
  if (Number.isFinite(n) && n > 0) return Math.min(n, 300);
  return 20;
}

export function resolvedLoginThrottleTtlMs(): number {
  const n = Number.parseInt(process.env.AUTH_LOGIN_THROTTLE_TTL_MS ?? '60000', 10);
  if (Number.isFinite(n) && n >= 1000 && n <= 3_600_000) return n;
  return 60_000;
}
