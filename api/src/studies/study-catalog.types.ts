export type StudyCatalogRow = {
  id: string;
  studyInstanceUID: string;
  studyDescription: string | null;
  studyDate: string | null;
  modality: string | null;
  /** Contagem quando o PACS inclui nos metados QIDO; senão null. */
  seriesCount: number | null;
  /** Contagem quando o PACS inclui nos metados QIDO; senão null. */
  instanceCount: number | null;
  /** URL opcional registada na BD (laudo PDF/página externa autenticada). */
  reportUrl: string | null;
  patient: {
    id: string;
    fullName: string;
    medicalRecordNumber: string;
  };
};

/** Agregação leve sobre o mesmo catálogo RBAC+PACS que `listForCurrentUser`. */
export type StudyCatalogSummary = {
  studyCount: number;
  studiesWithReportUrl: number;
  /** Soma de séries quando todos os estudos trazem a tag DICOM no QIDO; senão null. */
  totalSeries: number | null;
  /** Soma de instâncias quando todos trazem a tag; senão null. */
  totalInstances: number | null;
  modalityTop: { modality: string; count: number }[];
};
