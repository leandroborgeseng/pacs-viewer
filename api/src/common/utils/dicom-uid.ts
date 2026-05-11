import { randomBytes } from 'crypto';

/** UID DICOM formato 2.25 + inteiro grande (derivado de 128-bit aleatório). */
export function generateDicomUid(): string {
  const hex = randomBytes(16).toString('hex');
  return `2.25.${BigInt(`0x${hex}`).toString()}`;
}
