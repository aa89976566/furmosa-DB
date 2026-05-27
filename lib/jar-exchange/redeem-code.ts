import { prisma } from '@/lib/prisma';
import { isValidJarCodeFormat, normalizeJarCode } from '@/lib/jar-exchange/codes';
import { appendPointsLedger } from '@/lib/jar-exchange/points';
import { ensureJarExchangeService } from '@/lib/jar-exchange/services';

export type RedeemJarCodeResult =
  | { ok: true; pointsEarned: number; balanceAfter: number; code: string }
  | { ok: false; error: string; status: number };

export async function redeemJarCode(
  customerId: string,
  codeRaw: string,
): Promise<RedeemJarCodeResult> {
  const code = normalizeJarCode(codeRaw);
  if (!code) return { ok: false, error: '請輸入序號', status: 400 };
  if (!isValidJarCodeFormat(code)) {
    return { ok: false, error: '序號須為 8 位數字', status: 400 };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: '找不到會員', status: 404 };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const row = await tx.jarCode.findUnique({ where: { code } });
      if (!row) throw new JarExchangeError('序號不存在', 404);
      if (row.status === 'used') throw new JarExchangeError('序號已使用', 409);
      if (row.status === 'expired') throw new JarExchangeError('序號已過期', 409);

      const claimed = await tx.jarCode.updateMany({
        where: { id: row.id, status: 'unused' },
        data: {
          status: 'used',
          redeemedByCustomerId: customerId,
          redeemedAt: new Date(),
        },
      });
      if (claimed.count === 0) throw new JarExchangeError('序號已使用', 409);

      await ensureJarExchangeService(tx, customerId);

      const ledger = await appendPointsLedger(tx, {
        customerId,
        sourceType: 'jar_code_redeem',
        sourceRefId: row.id,
        pointsChange: row.pointValue,
        note: `序號 ${code}`,
      });

      return {
        pointsEarned: row.pointValue,
        balanceAfter: ledger.balanceAfter,
        code,
      };
    });

    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof JarExchangeError) {
      return { ok: false, error: e.message, status: e.status };
    }
    throw e;
  }
}

class JarExchangeError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'JarExchangeError';
  }
}
