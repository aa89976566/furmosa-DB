'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LiffShell } from '@/components/liff/liff-shell';
import { LiffStatus } from '@/components/liff/liff-status';
import { PetProfileFieldsBlock } from '@/components/customers/pet-profile-fields-block';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  liffPreviewFetch,
  withExistingVercelShare,
} from '@/lib/liff/vercel-share-fetch';

type Props = { liffId: string };

export function LiffRegisterClient({ liffId }: Props) {
  return (
    <LiffShell liffId={liffId} title="加入會員（註冊）">
      {({ idToken }) => <RegisterForm idToken={idToken} />}
    </LiffShell>
  );
}

function RegisterForm({ idToken }: { idToken: string }) {
  const searchParams = useSearchParams();
  const returnPath = searchParams.get('return');
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'ok' | 'err'; text?: string }>({
    type: 'idle',
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus({ type: 'loading' });
    const fd = new FormData(e.currentTarget);

    const petSpecies = String(fd.get('petSpecies') ?? '').trim() || null;
    const body = {
      idToken,
      name: String(fd.get('name') ?? ''),
      phone: String(fd.get('phone') ?? '').trim() || null,
      petSpecies,
      petSpeciesOther: String(fd.get('petSpeciesOther') ?? '').trim() || null,
      petName: String(fd.get('petName') ?? '').trim() || null,
      petAgeYears: String(fd.get('petAgeYears') ?? '').trim() || null,
      petBirthday: String(fd.get('petBirthday') ?? '').trim() || null,
    };

    try {
      const res = await liffPreviewFetch('/api/line/liff/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? '註冊失敗');
      if (returnPath && returnPath.startsWith('/liff/')) {
        window.location.href = withExistingVercelShare(returnPath, window.location.href);
        return;
      }
      setStatus({ type: 'ok', text: data.message ?? '完成！' });
    } catch (err) {
      setStatus({
        type: 'err',
        text: err instanceof Error ? err.message : '註冊失敗，請稍後再試',
      });
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <p className="text-sm text-muted-foreground">
        開戶不是辦會員，只是把這個 LINE 跟您家毛孩的檔案對起來。之後傳 8 位空罐序號就會入帳。
      </p>

      <Field label="您的稱呼（必填）">
        <Input name="name" required maxLength={80} placeholder="例：王小姐" autoComplete="name" />
      </Field>

      <Field label="手機（選填）">
        <Input
          name="phone"
          type="tel"
          inputMode="tel"
          maxLength={20}
          placeholder="例：0912345678"
          autoComplete="tel"
        />
      </Field>

      <PetProfileFieldsBlock />

      {status.type === 'ok' && status.text && <LiffStatus message={status.text} variant="success" />}
      {status.type === 'err' && status.text && <LiffStatus message={status.text} variant="error" />}

      <Button type="submit" className="w-full" disabled={status.type === 'loading' || status.type === 'ok'}>
        {status.type === 'loading' ? '送出中…' : status.type === 'ok' ? '已完成' : '完成註冊'}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        註冊後可直接在聊天室傳 8 位序號存罐，或點選單查看紀錄。
      </p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
