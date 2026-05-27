import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  COLS,
  LABEL_HEIGHT_MM,
  LABEL_WIDTH_MM,
  LABELS_PER_PAGE,
  PAGE_HEIGHT_MM,
  PAGE_MARGIN_MM,
  PAGE_WIDTH_MM,
  chunkForPrint,
} from '@/lib/jar-exchange/print-labels';

const mmToPt = (mm: number) => (mm * 72) / 25.4;

export function jarCodesPdfDownloadUrl(
  batch: string,
  status: 'unused' | 'used' = 'unused',
  options?: { limit?: number; all?: boolean },
): string {
  const q = new URLSearchParams({ batch, status });
  if (options?.all) {
    q.set('all', '1');
  } else {
    q.set('limit', String(options?.limit ?? LABELS_PER_PAGE));
  }
  return `/api/jar-exchange/codes/pdf?${q.toString()}`;
}

/** 依 A4 標籤格線產生 PDF（40×20mm，5 欄 × 14 列） */
export async function buildJarCodesPdf(
  codes: string[],
  batchNo?: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.CourierBold);

  if (batchNo) {
    doc.setTitle(`換罐序號 ${batchNo}`);
  }

  const pageW = mmToPt(PAGE_WIDTH_MM);
  const pageH = mmToPt(PAGE_HEIGHT_MM);
  const margin = mmToPt(PAGE_MARGIN_MM);
  const labelW = mmToPt(LABEL_WIDTH_MM);
  const labelH = mmToPt(LABEL_HEIGHT_MM);

  const pages = chunkForPrint(codes);

  for (const pageCodes of pages) {
    const page = doc.addPage([pageW, pageH]);

    for (let i = 0; i < LABELS_PER_PAGE; i++) {
      const row = Math.floor(i / COLS);
      const col = i % COLS;
      const x = margin + col * labelW;
      const y = pageH - margin - (row + 1) * labelH;

      page.drawRectangle({
        x,
        y,
        width: labelW,
        height: labelH,
        borderColor: rgb(0.6, 0.6, 0.6),
        borderWidth: 0.3,
      });

      const code = pageCodes[i];
      if (!code) continue;

      const fontSize = code.length > 8 ? 9 : 11;
      const textW = font.widthOfTextAtSize(code, fontSize);
      page.drawText(code, {
        x: x + (labelW - textW) / 2,
        y: y + (labelH - fontSize) / 2,
        size: fontSize,
        font,
      });
    }
  }

  return doc.save();
}
