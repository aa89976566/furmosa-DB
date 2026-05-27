/** 單張序號紙條：長 4cm × 寬 2cm */
export const LABEL_WIDTH_MM = 40;
export const LABEL_HEIGHT_MM = 20;

/** A4 可列印區（留 5mm 邊界） */
export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;
export const PAGE_MARGIN_MM = 5;

export const COLS = Math.floor(
  (PAGE_WIDTH_MM - PAGE_MARGIN_MM * 2) / LABEL_WIDTH_MM,
);
export const ROWS = Math.floor(
  (PAGE_HEIGHT_MM - PAGE_MARGIN_MM * 2) / LABEL_HEIGHT_MM,
);
export const LABELS_PER_PAGE = COLS * ROWS;

/** 一張 A4 對應的序號數量（預設批量生成數） */
export const DEFAULT_BATCH_SIZE = LABELS_PER_PAGE;

export function chunkForPrint<T>(items: T[], perPage = LABELS_PER_PAGE): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage));
  }
  return pages.length ? pages : [[]];
}
