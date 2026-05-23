import Link from 'next/link';

/** 結算明細「單號」：有訂單則進訂單，否則進銷售流水詳情 */
export function SettlementTxnLink({
  txnId,
  txnNumber,
  orderId,
  orderNumber,
}: {
  txnId: string;
  txnNumber: string;
  orderId?: string | null;
  orderNumber?: string | null;
}) {
  const href = orderId ? `/orders/${orderId}` : `/merchants/stock-txn/${txnId}`;
  const title = orderId
    ? `訂單 ${orderNumber ?? orderId}`
    : `銷售流水 ${txnNumber}`;

  return (
    <Link
      href={href}
      title={title}
      className="font-mono text-xs text-primary hover:underline"
    >
      {txnNumber}
    </Link>
  );
}
