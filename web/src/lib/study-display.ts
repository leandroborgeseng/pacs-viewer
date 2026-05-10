/** Study date DICOM típica (DA) `YYYYMMDD` ou com separadores. */
export function studyDateToComparable(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length !== 8) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

/** Exibe `YYYYMMDD` como `DD/MM/AAAA` quando possível; senão devolve o texto original. */
export function formatStudyDatePt(raw: string | null | undefined): string {
  if (!raw?.trim()) return "—";
  const d = raw.replace(/\D/g, "");
  if (d.length === 8) return `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}`;
  return raw;
}

/** Resumo Se/Img para worklist; `—` quando o PACS não expõe contagens. */
export function formatSeriesInstanceLabel(
  seriesCount: number | null | undefined,
  instanceCount: number | null | undefined,
): string {
  if (seriesCount == null && instanceCount == null) return "—";
  const se = seriesCount != null ? String(seriesCount) : "—";
  const im = instanceCount != null ? String(instanceCount) : "—";
  return `${se}/${im}`;
}
