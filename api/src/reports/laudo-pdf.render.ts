import PDFDocument from 'pdfkit';

/** Fallback seguro quando não há TTF próprio embutido: remove diacríticos para Helvetica PDF. */
function asciiClinicalText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?');
}

export async function renderLaudoPdfPdfkit(opts: {
  titleAscii: string;
  bodyAscii: string;
  footerAscii: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font('Helvetica');
    doc.fontSize(14).fillColor('#111').text(opts.titleAscii, { underline: true });
    doc.moveDown(0.8);
    doc.fontSize(11).text(opts.bodyAscii.replace(/\r\n/g, '\n'), {
      align: 'left',
    });
    doc.moveDown(1.2);
    doc.fontSize(9).fillColor('#555').text(opts.footerAscii, { align: 'left' });
    doc.end();
  });
}

export function clinicalPdfTexts(params: {
  title: string;
  body: string;
  footer: string;
}): { titleAscii: string; bodyAscii: string; footerAscii: string } {
  return {
    titleAscii: asciiClinicalText(params.title.trim() || '(sem título)'),
    bodyAscii: asciiClinicalText(params.body.trim() || ''),
    footerAscii: asciiClinicalText(params.footer),
  };
}
