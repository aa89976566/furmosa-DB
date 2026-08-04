/**
 * Read-only payment dedup audit（不得連 Production 除非明確允許）。
 *
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/payment-dedup-audit.ts
 *
 * 輸出：重複組數、pending/paid 數、payment id、金額、時間。
 * 不輸出顧客個資、callback payload、金鑰。
 */

import { PrismaClient } from '@prisma/client';

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('缺少 DATABASE_URL / DIRECT_URL');
    process.exit(1);
  }
  if (process.env.VERCEL_ENV === 'production' || process.env.REFILL_AUDIT_TARGET === 'production') {
    throw new Error('拒絕在 Production 標記下執行（設錯環境）');
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const groups = await prisma.$queryRaw<
      {
        refill_order_id: string;
        purpose: string;
        pending_n: bigint;
        paid_n: bigint;
        active_n: bigint;
        conflict_class: string;
      }[]
    >`
      SELECT
        refill_order_id,
        purpose,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_n,
        COUNT(*) FILTER (WHERE status = 'paid') AS paid_n,
        COUNT(*) AS active_n,
        CASE
          WHEN COUNT(*) FILTER (WHERE status = 'paid') >= 2 THEN 'PAID_PLUS_PAID_BLOCK'
          WHEN COUNT(*) FILTER (WHERE status = 'paid') = 1
           AND COUNT(*) FILTER (WHERE status = 'pending') >= 1 THEN 'PAID_PLUS_PENDING'
          WHEN COUNT(*) FILTER (WHERE status = 'pending') >= 2 THEN 'PENDING_PLUS_PENDING'
          ELSE 'OK'
        END AS conflict_class
      FROM payment_orders
      WHERE status IN ('pending', 'paid')
      GROUP BY refill_order_id, purpose
      HAVING COUNT(*) > 1
      ORDER BY conflict_class, refill_order_id, purpose
    `;

    const details = await prisma.$queryRaw<
      {
        refill_order_id: string;
        purpose: string;
        payment_order_id: string;
        status: string;
        amount: number;
        created_at: Date;
        paid_at: Date | null;
        merchant_trade_no_prefix: string;
      }[]
    >`
      SELECT
        po.refill_order_id,
        po.purpose,
        po.id AS payment_order_id,
        po.status,
        po.amount,
        po.created_at,
        po.paid_at,
        LEFT(po.merchant_trade_no, 4) || '…' AS merchant_trade_no_prefix
      FROM payment_orders po
      WHERE po.status IN ('pending', 'paid')
        AND EXISTS (
          SELECT 1
          FROM payment_orders x
          WHERE x.refill_order_id = po.refill_order_id
            AND x.purpose = po.purpose
            AND x.status IN ('pending', 'paid')
          GROUP BY x.refill_order_id, x.purpose
          HAVING COUNT(*) > 1
        )
      ORDER BY po.refill_order_id, po.purpose, po.status, po.created_at
    `;

    const paidPlusPaid = groups.filter((g) => g.conflict_class === 'PAID_PLUS_PAID_BLOCK');

    console.log(
      JSON.stringify(
        {
          duplicateGroupCount: groups.length,
          paidPlusPaidGroupCount: paidPlusPaid.length,
          migrationAllowed: paidPlusPaid.length === 0,
          groups: groups.map((g) => ({
            refill_order_id: g.refill_order_id,
            purpose: g.purpose,
            pending_n: Number(g.pending_n),
            paid_n: Number(g.paid_n),
            active_n: Number(g.active_n),
            conflict_class: g.conflict_class,
          })),
          details: details.map((d) => ({
            ...d,
            created_at: d.created_at?.toISOString?.() ?? d.created_at,
            paid_at: d.paid_at?.toISOString?.() ?? d.paid_at,
          })),
        },
        null,
        2,
      ),
    );

    if (paidPlusPaid.length > 0) {
      process.exitCode = 2;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
