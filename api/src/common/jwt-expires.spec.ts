import {
  JWT_EXPIRES_DEFAULT_SEC,
  JWT_EXPIRES_MAX_SEC,
  JWT_EXPIRES_MIN_SEC,
  jwtExpiresWasClamped,
  resolveJwtExpiresSec,
} from './jwt-expires';

describe('resolveJwtExpiresSec', () => {
  it('usa o default quando vazio ou inválido', () => {
    expect(resolveJwtExpiresSec(undefined)).toBe(JWT_EXPIRES_DEFAULT_SEC);
    expect(resolveJwtExpiresSec('')).toBe(JWT_EXPIRES_DEFAULT_SEC);
    expect(resolveJwtExpiresSec('abc')).toBe(JWT_EXPIRES_DEFAULT_SEC);
    expect(resolveJwtExpiresSec('-1')).toBe(JWT_EXPIRES_DEFAULT_SEC);
  });

  it('respeita valores dentro do intervalo', () => {
    expect(resolveJwtExpiresSec('3600')).toBe(3600);
    expect(resolveJwtExpiresSec(7200)).toBe(7200);
  });

  it('faz clamp ao mínimo e máximo', () => {
    expect(resolveJwtExpiresSec('60')).toBe(JWT_EXPIRES_MIN_SEC);
    expect(resolveJwtExpiresSec('999999999')).toBe(JWT_EXPIRES_MAX_SEC);
  });
});

describe('jwtExpiresWasClamped', () => {
  it('detecta clamp', () => {
    const r = resolveJwtExpiresSec('50');
    expect(jwtExpiresWasClamped('50', r)).toBe(true);
  });

  it('não marca default implícito', () => {
    const r = resolveJwtExpiresSec(undefined);
    expect(jwtExpiresWasClamped(undefined, r)).toBe(false);
  });
});
