import { prisma } from '@/lib/prisma';
import { loadRefillHistoryAudit } from '@/lib/refill/history-audit';

async function main() {
  const report = await loadRefillHistoryAudit(prisma);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.anomalies.length > 0) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
