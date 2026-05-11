import type { StudyCatalogRow, StudyCatalogSummary } from './study-catalog.types';

export function buildStudyCatalogSummary(rows: StudyCatalogRow[]): StudyCatalogSummary {
  const studyCount = rows.length;
  const studiesWithReportUrl = rows.reduce(
    (n, r) => n + (((r.reportUrl ?? '').trim().length > 0) ? 1 : 0),
    0,
  );
  const studiesWithPacsDocumentLaudo = rows.reduce(
    (n, r) => n + (r.hasPacsDocumentLaudo ? 1 : 0),
    0,
  );

  let totalSeries: number | null = null;
  if (studyCount > 0 && rows.every((r) => r.seriesCount != null)) {
    totalSeries = rows.reduce((acc, r) => acc + (r.seriesCount as number), 0);
  }
  let totalInstances: number | null = null;
  if (studyCount > 0 && rows.every((r) => r.instanceCount != null)) {
    totalInstances = rows.reduce((acc, r) => acc + (r.instanceCount as number), 0);
  }

  const modalityMap = new Map<string, number>();
  for (const r of rows) {
    const m = r.modality?.trim();
    if (!m) continue;
    modalityMap.set(m, (modalityMap.get(m) ?? 0) + 1);
  }
  const modalityTop = [...modalityMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([modality, count]) => ({ modality, count }));

  return {
    studyCount,
    studiesWithReportUrl,
    studiesWithPacsDocumentLaudo,
    totalSeries,
    totalInstances,
    modalityTop,
  };
}
