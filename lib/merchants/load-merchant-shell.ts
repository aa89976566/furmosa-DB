import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getMerchantIndustry } from '@/lib/merchant-industry-persist';
import { getMerchantTypes } from '@/lib/merchant-types-persist';
import type { MerchantType } from '@/lib/merchant-types';
import { prisma } from '@/lib/prisma';

export type MerchantShell = {
  id: string;
  name: string;
  merchantId: string;
  type: string;
  industry: string | null;
  types: MerchantType[];
  shipmentsInTransit: number;
  draftSettlements: number;
};

/** 同一 request 內 layout／子頁共用，避免每個 tab 重複查店家 */
export const getMerchantShell = cache(async (id: string): Promise<MerchantShell> => {
  const merchantRow = await prisma.merchant.findUnique({
    where: { id },
    select: { id: true, name: true, merchantId: true, type: true },
  });
  if (!merchantRow) notFound();

  const [industry, types, shipmentsInTransit, draftSettlements] = await Promise.all([
    getMerchantIndustry(prisma, id),
    getMerchantTypes(prisma, id, merchantRow.type),
    prisma.shipment.count({
      where: { merchantId: id, status: { in: ['pending', 'packed', 'shipped'] } },
    }),
    prisma.settlement.count({
      where: { merchantId: id, status: { in: ['draft', 'reviewing'] } },
    }),
  ]);

  return {
    id: merchantRow.id,
    name: merchantRow.name,
    merchantId: merchantRow.merchantId,
    type: merchantRow.type,
    industry,
    types,
    shipmentsInTransit,
    draftSettlements,
  };
});
