import { buildStudyCatalogSummary } from './study-catalog-summary';
import type { StudyCatalogRow } from './study-catalog.types';

function row(partial: Partial<StudyCatalogRow> & Pick<StudyCatalogRow, 'studyInstanceUID'>): StudyCatalogRow {
  const uid = partial.studyInstanceUID;
  return {
    id: partial.id ?? uid,
    studyInstanceUID: uid,
    studyDescription: partial.studyDescription ?? null,
    studyDate: partial.studyDate ?? null,
    modality: partial.modality ?? null,
    seriesCount: partial.seriesCount ?? null,
    instanceCount: partial.instanceCount ?? null,
    reportUrl: partial.reportUrl ?? null,
    hasPacsDocumentLaudo: partial.hasPacsDocumentLaudo ?? false,
    patient: partial.patient ?? {
      id: 'p:test',
      fullName: 'Test',
      medicalRecordNumber: '—',
    },
  };
}

describe('buildStudyCatalogSummary', () => {
  it('retorna contagens quando todos os estudos incluem série e instância', () => {
    const s = buildStudyCatalogSummary([
      row({ studyInstanceUID: '1.2.3', modality: 'CT', seriesCount: 2, instanceCount: 10 }),
      row({ studyInstanceUID: '1.2.4', modality: 'MR', seriesCount: 3, instanceCount: 20 }),
    ]);
    expect(s.studyCount).toBe(2);
    expect(s.totalSeries).toBe(5);
    expect(s.totalInstances).toBe(30);
    expect(s.studiesWithReportUrl).toBe(0);
    expect(s.studiesWithPacsDocumentLaudo).toBe(0);
    expect(s.modalityTop.map((x) => x.modality).sort()).toEqual(['CT', 'MR']);
  });

  it('mantém totalSeries/totalInstances a null quando algum estudo não tem contagens no QIDO', () => {
    const s = buildStudyCatalogSummary([
      row({ studyInstanceUID: '1', seriesCount: 1, instanceCount: 5 }),
      row({
        studyInstanceUID: '2',
        seriesCount: null,
        instanceCount: null,
      }),
    ]);
    expect(s.studyCount).toBe(2);
    expect(s.totalSeries).toBeNull();
    expect(s.totalInstances).toBeNull();
  });

  it('conta estudos com laudo URL registado no portal', () => {
    const s = buildStudyCatalogSummary([
      row({ studyInstanceUID: '1', reportUrl: 'https://report/a' }),
      row({ studyInstanceUID: '2', reportUrl: '   ' }),
      row({ studyInstanceUID: '3', reportUrl: null }),
    ]);
    expect(s.studiesWithReportUrl).toBe(1);
  });

  it('conta estudos com documento/laudo indicado pelo PACS (DOC/OT etc.)', () => {
    const s = buildStudyCatalogSummary([
      row({ studyInstanceUID: '1', hasPacsDocumentLaudo: true }),
      row({ studyInstanceUID: '2', hasPacsDocumentLaudo: false }),
      row({ studyInstanceUID: '3', hasPacsDocumentLaudo: true }),
    ]);
    expect(s.studiesWithPacsDocumentLaudo).toBe(2);
  });
});
