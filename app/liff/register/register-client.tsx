'use client';

import liff from '@line/liff';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check } from 'lucide-react';
import { LiffShell } from '@/components/liff/liff-shell';
import { LiffStatus } from '@/components/liff/liff-status';
import { LinePetFields } from './line-pet-fields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Props = { liffId: string };

export function LiffRegisterClient({ liffId }: Props) {
  return (
    <LiffShell liffId={liffId} title="加入匠寵會員" variant="sunny">
      {({ idToken }) => <RegisterForm idToken={idToken} />}
    </LiffShell>
  );
}

function RegisterForm({ idToken }: { idToken: string }) {
  const searchParams = useSearchParams();
  const returnPath = searchParams.get('return');
  const autoCloseTimerRef = useRef<number | null>(null);
  const autoCloseScheduledRef = useRef(false);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const [status, setStatus] = useState<{
    type: 'idle' | 'loading' | 'ok' | 'err';
    text?: string;
    isNew?: boolean;
  }>({ type: 'idle' });
  const [closeUnavailable, setCloseUnavailable] = useState(false);

  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current !== null) {
        window.clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (status.type === 'ok') {
      successHeadingRef.current?.focus();
    }
  }, [status.type]);

  function tryCloseLiffWindow() {
    try {
      if (!liff.isInClient()) {
        setCloseUnavailable(true);
        return;
      }
      liff.closeWindow();
    } catch {
      setCloseUnavailable(true);
    }
  }

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
    };

    try {
      const res = await fetch('/api/line/liff/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { message?: string; error?: string; isNew?: boolean };
      if (!res.ok) throw new Error(data.error ?? '註冊失敗');
      if (returnPath && returnPath.startsWith('/liff/')) {
        window.location.href = returnPath;
        return;
      }
      setStatus({ type: 'ok', text: data.message ?? '完成！', isNew: data.isNew });
      if (!autoCloseScheduledRef.current) {
        autoCloseScheduledRef.current = true;
        autoCloseTimerRef.current = window.setTimeout(tryCloseLiffWindow, 1000);
      }
    } catch (err) {
      setStatus({
        type: 'err',
        text: err instanceof Error ? err.message : '註冊失敗，請稍後再試',
      });
    }
  }

  if (status.type === 'ok') {
    return (
      <section
        className="rounded-[28px] border-2 border-[#5b9bec] bg-white px-5 py-8 text-center shadow-[6px_7px_0_#ffd84d]"
        role="status"
        aria-live="polite"
      >
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#ffd84d] text-[#17345f]">
          <Check className="h-8 w-8" strokeWidth={2.5} aria-hidden="true" />
        </span>
        <h2
          ref={successHeadingRef}
          tabIndex={-1}
          className="mt-5 text-2xl font-bold tracking-tight text-[#17345f] outline-none"
        >
          {status.isNew ? '已加入匠寵會員' : '會員資料已更新'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">正在帶您回到 LINE…</p>

        <Button
          type="button"
          className="mt-6 min-h-12 w-full rounded-full bg-[#2368b5] text-base font-semibold text-white hover:bg-[#1c5798]"
          onClick={tryCloseLiffWindow}
        >
          回到 LINE
        </Button>
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          {closeUnavailable ? '請關閉此頁並回到 LINE。' : '若頁面沒有自動返回，請點上方按鈕。'}
        </p>
      </section>
    );
  }

  return (
    <form
      className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      onSubmit={onSubmit}
      aria-busy={status.type === 'loading'}
    >
      <section className="overflow-hidden rounded-[28px] border-2 border-[#5b9bec] bg-white shadow-[6px_7px_0_#ffd84d]">
        <div className="relative mx-auto h-52 w-full bg-[#fffaf0]">
          <Image
            src="/line/grooming/member-register-bath-dog.png"
            alt="洗完澡披著黃色毛巾的藍色狗狗插畫"
            fill
            priority
            sizes="(max-width: 448px) 100vw, 416px"
            className="object-cover object-[center_34%]"
          />
        </div>
        <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[#17345f]">先留下基本資料</h2>
          <span className="shrink-0 rounded-full bg-[#ffd84d] px-3 py-1 text-xs font-bold text-[#17345f]">
            約 30 秒
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-[#52677e]">
          用 LINE 保存洗澡、換罐與毛孩紀錄。
        </p>
        </div>
      </section>

      <section className="space-y-4 rounded-[28px] border-2 border-[#91bdf3] bg-white p-5">
        <h2 className="text-base font-bold text-[#17345f]">基本資料</h2>

        <Field label="您的稱呼（必填）">
          <Input
            name="name"
            required
            maxLength={80}
            placeholder="例：王小姐"
            autoComplete="name"
            className="h-12 rounded-2xl border-2 border-[#91bdf3] px-4 text-base text-[#17345f] focus-visible:ring-[#2368b5]"
          />
        </Field>

        <Field label="手機（選填）">
          <Input
            name="phone"
            type="tel"
            inputMode="tel"
            maxLength={20}
            placeholder="例：0912345678"
            autoComplete="tel"
            className="h-12 rounded-2xl border-2 border-[#91bdf3] px-4 text-base text-[#17345f] focus-visible:ring-[#2368b5]"
          />
        </Field>
      </section>

      <LinePetFields />

      {status.type === 'err' && status.text && (
        <div role="alert">
          <LiffStatus message={status.text} variant="error" />
        </div>
      )}

      <Button
        type="submit"
        className="min-h-12 w-full rounded-full bg-[#2368b5] text-base font-bold text-white shadow-[4px_5px_0_#ffd84d] hover:bg-[#1c5798]"
        disabled={status.type === 'loading'}
      >
        {status.type === 'loading' ? '正在加入…' : '加入會員'}
      </Button>

      <p className="px-2 text-center text-xs leading-5 text-zinc-500">
        送出即代表同意讓匠寵以此 LINE 建立毛孩服務紀錄。
      </p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#17345f]">{label}</label>
      {children}
    </div>
  );
}
