import { getLiffIdIfConfigured } from '@/lib/line/liff-config';
import { LiffRefillClient } from './refill-client';

export const dynamic = 'force-dynamic';

export default async function LiffRefillPage(
  props: {
    searchParams?: Promise<{ storeId?: string; orderId?: string; paid?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const liffId = getLiffIdIfConfigured('refill') ?? getLiffIdIfConfigured('register');
  if (!liffId) {
    return (
      <div className="mx-auto max-w-md p-6 text-sm text-muted-foreground">
        換罐付款頁尚未設定。請在環境變數設定 LINE_LIFF_ID_REFILL 後重新部署。
      </div>
    );
  }

  return (
    <LiffRefillClient
      liffId={liffId}
      storeId={searchParams?.storeId ?? null}
      orderId={searchParams?.orderId ?? null}
      paidHint={searchParams?.paid === '1'}
    />
  );
}
