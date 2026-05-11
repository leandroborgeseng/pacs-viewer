import type { OrthancStudyTags } from '../dicom-web/orthanc-rest.client';

/** Objecto «naturalizado» esperado pelo dcmjs antes de gravar Encapsulated PDF Storage. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NaturalEncapsulatedPdfDataset = Record<string, any>;

export function naturalDatasetEncapsulatedPdf(
  tags: OrthancStudyTags,
  o: {
    pdfBuffer: Buffer;
    sopInstanceUid: string;
    seriesInstanceUid: string;
    seriesDescription: string;
    seriesNumberStr: string;
    manufacturer: string;
  },
): NaturalEncapsulatedPdfDataset {
  const pdf = new Uint8Array(o.pdfBuffer);

  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');
  const yyyy = `${d.getFullYear()}`;
  const ContentDate = `${yyyy}${p2(d.getMonth() + 1)}${p2(d.getDate())}`;
  const ContentTime = `${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;

  const docTitle =
    (o.seriesDescription || 'Laudo PDF').slice(0, 64) ||
    'Laudo PDF';

  return {
    _meta: {
      TransferSyntaxUID: { vr: 'UI', Value: ['1.2.840.10008.1.2.1'] },
    },
    SOPClassUID: '1.2.840.10008.5.1.4.1.1.104.1',
    SOPInstanceUID: o.sopInstanceUid,
    StudyInstanceUID: tags.StudyInstanceUID,
    SeriesInstanceUID: o.seriesInstanceUid,
    SeriesDescription: o.seriesDescription,
    SeriesNumber: o.seriesNumberStr,
    Modality: 'DOC',
    InstanceNumber: '1',
    Manufacturer: o.manufacturer,
    ManufacturerModelName: 'BlueBeaver pacs-viewer',
    PatientName: tags.PatientName ?? '',
    PatientID: tags.PatientID ?? '',
    PatientBirthDate: tags.PatientBirthDate ?? '',
    PatientSex: tags.PatientSex ?? '',
    StudyDate: tags.StudyDate ?? '',
    StudyTime: tags.StudyTime ?? '',
    StudyDescription: tags.StudyDescription ?? '',
    AccessionNumber: tags.AccessionNumber ?? '',
    SpecificCharacterSet: 'ISO_IR 192',
    ContentDate,
    ContentTime,
    MIMETypeOfEncapsulatedDocument: 'application/pdf',
    EncapsulatedDocument: pdf,
    DocumentTitle: docTitle,
    BurnedInAnnotation: 'NO',
  };
}
