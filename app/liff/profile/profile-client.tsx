'use client';

import { useCallback, useEffect, useState } from 'react';
import { LiffShell } from '@/components/liff/liff-shell';
import { LiffStatus } from '@/components/liff/liff-status';
import { ecoNoteForJarCount } from '@/lib/line/jar-deposit-copy';

type Dashboard =
  | { registered: false }
  | {
      registered: true;
      name: string;
      customerCode: string;
      petName: string | null;
      petSpeciesLabel: string | null;
      petAgeYears: number | null;
      petBirthday: string | null;
      phone: string | null;
      pointsBalance: number;
      jarsDeposited: number;
      rewardsRedeemed: number;
    };

type Props = {
  liffId: string;
  mode?: 'profile' | 'merchant-bind';
  bindToken?: string;
};

export function LiffProfileClient({ liffId, mode = 'profile', bindToken }: Props) {
  return (
    <LiffShell
      liffId={liffId}
      title={mode === 'merchant-bind' ? '綁定店家 LINE 通知' : '會員資料與存罐紀錄'}
    >
      {({ idToken }) =>
        mode === 'merchant-bind' ? (
          <MerchantBindBody idToken={idToken} bindToken={bindToken} />
        ) : (
          <ProfileBody idToken={idToken} />
        )
      }
    </LiffShell>
  );
}

function MerchantBindBody({
  idToken,
  bindToken,
}: {
  idToken: string;
  bindToken?: string;
}) {
  const [status, setStatus] = useState<'binding' | 'done' | 'error'>('binding');
  const [message, setMessage] = useState('正在綁定 LINE…');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!bindToken) throw new Error('綁定連結無效，請回 POS 重新點擊綁定。');
        const res = await fetch('/api/line/liff/merchant-bind', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, bindToken }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? '綁定失敗');
        if (active) {
          setStatus('done');
          setMessage('LINE 綁定完成，之後補貨寄出時會收到通知。');
        }
      } catch (error) {
        if (active) {
          setStatus('error');
          setMessage(error instanceof Error ? error.message : '綁定失敗，請重新登入 POS 後再試。');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [bindToken, idToken]);

  return (
    <div className="space-y-4">
      <LiffStatus
        message={message}
        variant={status === 'error' ? 'error' : status === 'done' ? 'success' : 'info'}
      />
      {status !== 'binding' ? (
        <a
          href="/pos/account"
          className="flex min-h-[48px] w-full items-center justify-center rounded-md bg-primary px-4 font-medium text-primary-foreground"
        >
          返回店家資料
        </a>
      ) : null}
    </div>
  );
}

function ProfileBody({ idToken }: { idToken: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/line/liff/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = (await res.json()) as { dashboard?: Dashboard; error?: string };
      if (!res.ok) throw new Error(data.error ?? '讀取失敗');
      setDashboard(data.dashboard ?? { registered: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : '讀取失敗');
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">載入中…</p>;
  }

  if (error) {
    return <LiffStatus message={error} variant="error" />;
  }

  if (!dashboard?.registered) {
    return (
      <LiffStatus
        message="尚未註冊。請先點圖文選單「加入會員（註冊）」完成開戶，之後序號才會記對人。"
        variant="info"
      />
    );
  }

  const eco = ecoNoteForJarCount(dashboard.jarsDeposited);
  const petBits = [
    dashboard.petSpeciesLabel,
    dashboard.petName ? `「${dashboard.petName}」` : null,
    dashboard.petAgeYears !== null ? `約 ${dashboard.petAgeYears} 歲` : null,
    dashboard.petBirthday ? `生日 ${dashboard.petBirthday}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-medium text-muted-foreground">會員</h2>
        <p className="mt-1 text-lg font-semibold">{dashboard.name}</p>
        {dashboard.phone && (
          <p className="mt-1 text-sm text-muted-foreground">手機 {dashboard.phone}</p>
        )}
        {petBits.length > 0 && (
          <p className="mt-2 text-sm text-foreground">毛孩：{petBits.join(' · ')}</p>
        )}
      </section>

      <section className="rounded-xl border bg-primary/5 p-4">
        <h2 className="text-sm font-medium text-muted-foreground">罐罐點數</h2>
        <p className="mt-1 text-3xl font-bold tabular-nums text-primary">{dashboard.pointsBalance}</p>
        <p className="mt-1 text-xs text-muted-foreground">點</p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <StatCard label="累積已換罐" value={dashboard.jarsDeposited} suffix="罐" />
        <StatCard label="已兌換獎勵" value={dashboard.rewardsRedeemed} suffix="次" />
      </section>

      {eco && (
        <p className="rounded-xl border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">{eco}</p>
      )}

      <p className="text-center text-xs text-muted-foreground">
        存罐：在聊天室直接傳 8 位空罐序號即可入帳。
      </p>

      <button
        type="button"
        onClick={() => void load()}
        className="w-full text-center text-xs text-primary underline-offset-2 hover:underline"
      >
        重新整理
      </button>
    </div>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">
        {value}
        <span className="ml-0.5 text-sm font-normal text-muted-foreground">{suffix}</span>
      </p>
    </div>
  );
}
