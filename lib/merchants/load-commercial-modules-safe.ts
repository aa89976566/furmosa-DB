import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const merchantCommercialModuleSelect = {
  id: true,
  mode: true,
  effectiveFrom: true,
  effectiveUntil: true,
} satisfies Prisma.MerchantCommercialModuleSelect;

export type MerchantCommercialModuleSummary =
  Prisma.MerchantCommercialModuleGetPayload<{
    select: typeof merchantCommercialModuleSelect;
  }>;

type CommercialModuleLoader = (
  args: Prisma.MerchantCommercialModuleFindManyArgs,
) => Promise<MerchantCommercialModuleSummary[]>;

export type MerchantCommercialModulesResult =
  | { status: 'ok'; modules: MerchantCommercialModuleSummary[] }
  | { status: 'unavailable' };

const DRIFT_ERROR_CODES = new Set(['P2021', 'P2022']);

function safeDriftMeta(meta: Record<string, unknown> | undefined) {
  if (!meta) return undefined;
  const safe = Object.fromEntries(
    ['table', 'column', 'modelName']
      .filter((key) => key in meta)
      .map((key) => [key, meta[key]]),
  );
  return Object.keys(safe).length > 0 ? safe : undefined;
}

export async function loadMerchantCommercialModulesSafe(
  merchantId: string,
  loader: CommercialModuleLoader = (args) =>
    prisma.merchantCommercialModule.findMany(args),
): Promise<MerchantCommercialModulesResult> {
  try {
    const modules = await loader({
      where: { merchantId },
      orderBy: { effectiveFrom: 'desc' },
      select: merchantCommercialModuleSelect,
    });
    return { status: 'ok', modules };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      DRIFT_ERROR_CODES.has(error.code)
    ) {
      console.error('[merchant-detail]', {
        event: 'merchant_detail.commercial_modules_unavailable',
        merchantId,
        code: error.code,
        meta: safeDriftMeta(error.meta),
      });
      return { status: 'unavailable' };
    }
    throw error;
  }
}
