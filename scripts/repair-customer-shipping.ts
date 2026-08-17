/**
 * 正規化舊 customer order 配送字串。預設 dry-run，不寫入。
 * 套用：npx tsx scripts/repair-customer-shipping.ts --apply
 * 只回報 orderId／計數／skipped 原因，不印姓名、電話、地址。
 */
import {
  repairCustomerShipping,
  summarizeRepairResult,
} from '@/lib/orders/repair-customer-shipping';

async function main() {
  const apply = process.argv.includes('--apply');
  const result = await repairCustomerShipping({ dryRun: !apply });
  console.log(JSON.stringify(summarizeRepairResult(result), null, 2));
}

main().catch((err) => {
  console.error(
    '[repair-customer-shipping] failed',
    err instanceof Error ? err.message : 'unknown error',
  );
  process.exit(1);
});
