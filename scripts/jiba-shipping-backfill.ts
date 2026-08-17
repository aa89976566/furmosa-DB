/**
 * 一次性修復：已核准且付款條件已滿足、卻沒有出貨單的開箱申請。
 * 預設 dry-run。套用：npx tsx scripts/jiba-shipping-backfill.ts --apply
 * 不會印出完整轉帳帳號。
 */
import { backfillJibaReadyToShip } from '@/lib/campaigns/jiba-two-piece/service';

async function main() {
  const apply = process.argv.includes('--apply');
  const result = await backfillJibaReadyToShip({ dryRun: !apply });
  console.log(
    JSON.stringify(
      {
        dryRun: result.dryRun,
        scanned: result.scanned,
        candidateCount: result.candidates.length,
        repaired: result.repaired,
        candidates: result.candidates,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error('[jiba-shipping-backfill] failed', err instanceof Error ? err.message : err);
  process.exit(1);
});
