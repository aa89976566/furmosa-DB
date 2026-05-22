import type { Prisma } from '@prisma/client';

const pad = (n: number, width = 4) => String(n).padStart(width, '0');

export function stockTxnYmd(d = new Date()) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

type StockTxnDb = Pick<Prisma.TransactionClient, 'merchantStockTxn'>;

/** 一次保留多個連號，避免迴圈內重複查詢產生相同 txnNumber */
export async function reserveStockTxnNumbers(
  db: StockTxnDb,
  count: number,
  d = new Date(),
): Promise<string[]> {
  if (count <= 0) return [];

  const prefix = `MTXN-${stockTxnYmd(d)}-`;
  const last = await db.merchantStockTxn.findFirst({
    where: { txnNumber: { startsWith: prefix } },
    orderBy: { txnNumber: 'desc' },
  });

  let seq = 1;
  if (last) {
    const parsed = Number(last.txnNumber.slice(prefix.length));
    if (Number.isFinite(parsed)) seq = parsed + 1;
  }

  return Array.from({ length: count }, (_, i) => `${prefix}${pad(seq + i, 4)}`);
}

export async function nextStockTxnNumber(db: StockTxnDb, d = new Date()) {
  const [n] = await reserveStockTxnNumbers(db, 1, d);
  return n;
}
