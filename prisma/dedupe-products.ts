/**
 * 合併同名重複商品：每組只保留一筆，其餘合併後刪除。
 * 用法：npx tsx prisma/dedupe-products.ts [--dry-run]
 */
import { dedupeProductsByName } from '../lib/products/dedupe-products';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const result = await dedupeProductsByName(dryRun);

  if (result.groupCount === 0) {
    console.log('✓ 沒有同名重複商品');
    return;
  }

  console.log(`${dryRun ? '[預覽]' : '✓'} 處理 ${result.groupCount} 組重複：`);
  for (const action of result.actions) {
    console.log(`  「${action.name}」保留 ${action.keep}，移除 ${action.remove.join('、')}`);
  }

  if (dryRun) {
    console.log('\n確認後執行：npx tsx prisma/dedupe-products.ts');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
