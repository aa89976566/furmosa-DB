/**
 * 刪除未綁定店家的換罐會員，並將其已兌換序號退回未使用。
 *
 * 執行：npx tsx scripts/cleanup-unbound-jar-customers.ts
 * 加上 --dry-run 僅預覽不寫入。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

function isUnboundStore(signupStore: string | null, storeId: string | null) {
  return !signupStore?.trim() && !storeId?.trim();
}

async function main() {
  const candidates = await prisma.customer.findMany({
    where: {
      AND: [
        { OR: [{ signupStore: null }, { signupStore: '' }] },
        { OR: [{ storeId: null }, { storeId: '' }] },
      ],
      services: { some: { serviceType: 'jar_exchange' } },
    },
    select: {
      id: true,
      customerId: true,
      name: true,
      lineUserId: true,
      _count: {
        select: {
          orders: true,
          subscriptions: true,
          jarCodesRedeemed: true,
          groomingCoupons: true,
        },
      },
      jarCodesRedeemed: { select: { code: true, status: true } },
    },
    orderBy: { customerId: 'asc' },
  });

  if (candidates.length === 0) {
    console.log('沒有符合條件的未綁定換罐會員。');
    return;
  }

  console.log(`${dryRun ? '[dry-run] ' : ''}將處理 ${candidates.length} 位未綁定店家換罐會員：\n`);

  let releasedCodes = 0;
  let deletedCustomers = 0;

  for (const customer of candidates) {
    if (!isUnboundStore(null, null)) {
      // defensive; query already filters
    }

    const codes = customer.jarCodesRedeemed.map((c) => c.code);
    console.log(
      `- ${customer.customerId} ${customer.name}` +
        ` | 訂單 ${customer._count.orders} | 序號 ${codes.length}` +
        (codes.length ? ` [${codes.join(', ')}]` : ''),
    );

    if (dryRun) continue;

    await prisma.$transaction(async (tx) => {
      const reset = await tx.jarCode.updateMany({
        where: { redeemedByCustomerId: customer.id },
        data: {
          status: 'unused',
          redeemedByCustomerId: null,
          redeemedAt: null,
        },
      });
      releasedCodes += reset.count;

      if (customer.lineUserId) {
        await tx.lineChatSession.deleteMany({ where: { lineUserId: customer.lineUserId } });
      }

      await tx.customer.delete({ where: { id: customer.id } });
      deletedCustomers += 1;
    });
  }

  if (dryRun) {
    console.log('\n[dry-run] 未寫入資料庫。移除 --dry-run 後執行實際刪除。');
    return;
  }

  console.log(`\n完成：刪除 ${deletedCustomers} 位會員，釋放 ${releasedCodes} 組序號為未使用。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
