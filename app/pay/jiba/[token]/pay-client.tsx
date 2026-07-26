'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function JibaPayClient(props: {
  token: string;
  canPay: boolean;
  alreadyPaid: boolean;
  amount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (props.alreadyPaid) {
    return (
      <p className="rounded-xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">
        錢到了。雞霸準備離家。
      </p>
    );
  }

  if (!props.canPay) {
    return (
      <p className="rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-600">
        這筆申請目前不能付款。可能還在審核，或已取消。
      </p>
    );
  }

  async function onPay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pay/jiba/${props.token}`, { method: 'POST' });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || '付款失敗，請稍後再試');
        return;
      }
      router.refresh();
    } catch {
      setError('網路有點不穩，再按一次');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={loading}
        onClick={() => void onPay()}
        className="w-full rounded-xl bg-emerald-800 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
      >
        {loading ? '處理中…' : `支付 NT$${props.amount} 運費`}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
