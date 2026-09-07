import type { PromotionSummaryView } from '@/lib/orders/fulfillment-plan';

export function OmsPromotionSummary({ summary }: { summary: PromotionSummaryView }) {
  const unknown = !summary.determinate;
  const row = (label: string, value: number | null) => (
    <p className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{unknown || value === null ? '待確認' : value}</span>
    </p>
  );
  return <section className="space-y-2 rounded-lg border bg-muted/30 p-3" aria-label="活動贈品摘要">
    <p className="text-sm font-semibold">{summary.campaignTitle}</p>
    <p className="text-sm">{summary.statusLabel}</p>
    {summary.details.map(detail => (
      <p key={detail} className="text-sm text-warning">{detail}</p>
    ))}
    {row('購買', summary.purchaseQuantity)}
    {row('活動贈品', summary.campaignGiftQuantity)}
    {row('其他贈品', summary.otherGiftQuantity)}
    <p className={`text-sm font-medium ${unknown ? 'text-warning' : ''}`}>{summary.expectedShipLabel}</p>
  </section>;
}
