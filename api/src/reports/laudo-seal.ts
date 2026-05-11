import {
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

function sha256Hex(utf8: string): string {
  return createHash('sha256').update(utf8, 'utf8').digest('hex');
}

/** JSON estável ordenado por chave (determinístico). */
export function stableStringify(payload: Record<string, string>): string {
  const keys = Object.keys(payload).sort();
  const o: Record<string, string> = {};
  for (const k of keys) o[k] = payload[k];
  return JSON.stringify(o);
}

export type LaudoSealParts = {
  verifyCode: string;
  canonicalPayload: string;
  sealMacHex: string;
};

/** Código público hexadecimal (ASCII seguro para PDF). */
export function generateVerifyCodeHex(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Selo sintético: HMAC com segredo apenas no servidor. Não é assinatura ICP-Brasil.
 * `titlePrintedAscii` e `bodyPrintedAscii` devem ser os mesmos de `clinicalPdfTexts`/`asciiClinicalText`.
 */
export function computeLaudoSeal(params: {
  secret: string;
  titlePrintedAscii: string;
  bodyPrintedAscii: string;
  studyInstanceUid: string;
  issuerUserSub: string;
  issuerEmail: string;
  sopInstanceUid: string;
  issuedAtIsoUtc: string;
  verifyCode: string;
}): LaudoSealParts {
  const bodyShaHex = sha256Hex(params.bodyPrintedAscii);
  const canonicalPayload = stableStringify({
    v: '1',
    bodySha256Hex: bodyShaHex,
    titlePrintedAscii: params.titlePrintedAscii,
    issuedAtUtc: params.issuedAtIsoUtc,
    issuerEmailNorm: params.issuerEmail.trim().toLowerCase(),
    issuerSub: params.issuerUserSub,
    sopInstanceUid: params.sopInstanceUid,
    studyInstanceUid: params.studyInstanceUid,
    verifyCode: params.verifyCode,
  });
  const sealMacHex = createHmac('sha256', params.secret)
    .update(canonicalPayload, 'utf8')
    .digest('hex');
  return { verifyCode: params.verifyCode, canonicalPayload, sealMacHex };
}

function timingSafeEqualsHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(a) || !/^[0-9a-f]{64}$/i.test(b)) return false;
  const ba = Buffer.from(a.toLowerCase(), 'hex');
  const bb = Buffer.from(b.toLowerCase(), 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function verifyLaudoSealMac(
  secret: string,
  canonicalPayload: string,
  sealMacHex: string,
): boolean {
  const expected = createHmac('sha256', secret)
    .update(canonicalPayload, 'utf8')
    .digest('hex');
  try {
    return timingSafeEqualsHex(expected, sealMacHex);
  } catch {
    return false;
  }
}
