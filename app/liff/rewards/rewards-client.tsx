'use client';

import { useCallback, useEffect, useState } from 'react';
import { LiffShell } from '@/components/liff/liff-shell';
import { LiffStatus } from '@/components/liff/liff-status';
import { Button } from '@/components/ui/button';

type Reward = {
  index: number;
  rewardName: string;
  pointsRequired: number;
};

type Dashboard = { registered: boolean; pointsBalance?: number };

type Props = { liffId: string };

export function LiffRewardsClient({ liffId }: Props) {
  return (
    <LiffShell liffId={liffId} title="兌換獎勵">
      {({ idToken }) => <RewardsBody idToken={idToken} />}
    </LiffShell>
  );
}

function RewardsBody({ idToken }: { idToken: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redeeming, setRedeeming] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ variant: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/line/liff/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = (await res.json()) as {
        dashboard?: Dashboard & { pointsBalance?: number };
        rewards?: Reward[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? '讀取失敗');
      setDashboard(data.dashboard ?? { registered: false });
      setRewards(data.rewards ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '讀取失敗');
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function redeem(index: number) {
    setRedeeming(index);
    setNotice(null);
    try {
      const res = await fetch('/api/line/liff/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, rewardIndex: index }),
      });
      const data = (await res.json()) as {
        message?: string;
        error?: string;
        dashboard?: Dashboard & { pointsBalance?: number };
      };
      if (!res.ok) throw new Error(data.error ?? '兌換失敗');
      setNotice({ variant: 'success', text: data.message ?? '兌換成功' });
      if (data.dashboard?.registered) {
        setDashboard(data.dashboard);
      }
      await load();
    } catch (e) {
      setNotice({
        variant: 'error',
        text: e instanceof Error ? e.message : '兌換失敗',
      });
    } finally {
      setRedeeming(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">載入中…</p>;
  }

  if (error) {
    return <LiffStatus message={error} variant="error" />;
  }

  if (!dashboard?.registered) {
    return (
      <LiffStatus
        message="請先點「加入會員（註冊）」完成開戶，才能兌換獎勵。"
        variant="info"
      />
    );
  }

  const balance = dashboard.pointsBalance ?? 0;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-primary/5 px-4 py-3">
        <p className="text-xs text-muted-foreground">目前罐罐點數</p>
        <p className="text-2xl font-bold tabular-nums text-primary">{balance} 點</p>
      </div>

      {notice && <LiffStatus message={notice.text} variant={notice.variant} />}

      {rewards.length === 0 ? (
        <LiffStatus message="目前沒有可兌換的獎勵，請稍後再試。" variant="info" />
      ) : (
        <ul className="space-y-3">
          {rewards.map((r) => {
            const canAfford = balance >= r.pointsRequired;
            return (
              <li key={r.index} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">兌換 {r.index}</p>
                    <p className="mt-0.5 font-medium">{r.rewardName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{r.pointsRequired} 罐罐點數</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!canAfford || redeeming !== null}
                    onClick={() => void redeem(r.index)}
                  >
                    {redeeming === r.index ? '兌換中…' : canAfford ? '兌換' : '點數不足'}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-center text-xs text-muted-foreground">
        兌換成功後會顯示優惠券碼，請截圖保存至合作店家使用。
      </p>
    </div>
  );
}
