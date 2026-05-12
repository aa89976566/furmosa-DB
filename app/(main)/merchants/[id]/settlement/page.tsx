import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { calcSettlement, defaultPeriod } from '@/lib/settlement-calc';
import { createSettlement } from '@/app/(main)/settlements/actions';
import { MerchantSettlementSection } from '../merchant-settlement-section';

export const dynamic = 'force-dynamic';

function toInputDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default async function MerchantSettlementPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { settle_from?: string; settle_to?: string; settle_shipping?: string };
}) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!merchant) notFound();

  const past = await prisma.settlement.findMany({
    where: { merchantId: merchant.id },
    orderBy: { periodEnd: 'desc' },
    take: 30,
  });

  const def = defaultPeriod();
  const defaultFrom = toInputDate(def.start);
  const defaultTo = toInputDate(def.end);
  const settleFromStr = searchParams?.settle_from ?? null;
  const settleToStr = searchParams?.settle_to ?? null;
  const shippingFee = Number(searchParams?.settle_shipping ?? 0) || 0;
  const hasPreviewQuery = !!(settleFromStr && settleToStr);

  let settlementPreview: Awaited<ReturnType<typeof calcSettlement>> | null = null;
  if (hasPreviewQuery) {
    const [yS, mS, dS] = settleFromStr!.split('-').map(Number);
    const [yE, mE, dE] = settleToStr!.split('-').map(Number);
    settlementPreview = await calcSettlement({
      merchantId: merchant.id,
      periodStart: new Date(yS, mS - 1, dS, 0, 0, 0),
      periodEnd: new Date(yE, mE - 1, dE, 23, 59, 59),
      shippingFee,
    });
  }

  const previewForClient = settlementPreview
    ? {
        totalQuantity: settlementPreview.totalQuantity,
        cashCollected: settlementPreview.cashCollected,
        commissionAmount: settlementPreview.commissionAmount,
        effectiveCommissionRate: settlementPreview.effectiveCommissionRate,
        lines: settlementPreview.lines.map((l) => ({
          txnId: l.txnId,
          txnNumber: l.txnNumber,
          productId: l.productId,
          productName: l.productName,
          sku: l.sku,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          grossSales: l.grossSales,
          commissionAmount: l.commissionAmount,
          companyRevenue: l.companyRevenue,
          createdAt: l.createdAt.toISOString(),
        })),
      }
    : null;

  const pastSettlementsForClient = past.map((s) => ({
    id: s.id,
    settlementId: s.settlementId,
    periodStart: s.periodStart.toISOString(),
    periodEnd: s.periodEnd.toISOString(),
    grossSales: Number(s.grossSales),
    commissionAmount: Number(s.commissionAmount),
    shippingFee: Number(s.shippingFee),
    merchantOwesUs: Number(s.merchantOwesUs),
    payable: Number(s.payable),
    status: s.status,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6 p-6">
      <MerchantSettlementSection
        merchantId={merchant.id}
        defaultFrom={defaultFrom}
        defaultTo={defaultTo}
        currentFrom={settleFromStr}
        currentTo={settleToStr}
        shippingFee={shippingFee}
        preview={previewForClient}
        pastSettlements={pastSettlementsForClient}
        createSettlementAction={createSettlement}
        hasPreviewQuery={hasPreviewQuery}
      />
    </div>
  );
}
