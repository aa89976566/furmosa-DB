'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { Check, ExternalLink } from 'lucide-react';
import {
  createPosAccessAction,
  type PosAccessState,
} from '@/app/(main)/merchants/[id]/pos-access/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const initialState: PosAccessState = { error: null };

export function MerchantPosAccessForm({
  merchantId,
  merchantName,
}: {
  merchantId: string;
  merchantName: string;
}) {
  const action = createPosAccessAction.bind(null, merchantId);
  const [state, formAction] = useFormState(action, initialState);

  if (state.ok) {
    return (
      <div className="space-y-5 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-950 text-white">
          <Check className="h-7 w-7" />
        </span>
        <div>
          <h2 className="text-2xl font-bold">POS 帳號已建立</h2>
          <p className="mt-2 text-sm text-neutral-600">請將帳號與密碼分開、安全地交給店家。</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline" className="h-12 flex-1 border-2 border-neutral-950">
            <Link href={`/merchants/${merchantId}`}>返回店家資料</Link>
          </Button>
          <Button asChild className="h-12 flex-1 bg-neutral-950 text-white">
            <Link href="/pos/login" target="_blank">開啟 POS 登入頁<ExternalLink className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">設定 POS 登入帳號</h2>
        <p className="mt-2 text-sm text-neutral-600">店家：{merchantName}</p>
      </div>
      {state.error ? (
        <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">登入帳號</span>
        <Input name="username" required autoCapitalize="none" autoCorrect="off" className="h-12 border-2 border-neutral-300" placeholder="例：maohai.tamsui" />
        <span className="mt-1 block text-xs text-neutral-500">使用英文或數字，至少 4 個字元。</span>
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">店員顯示名稱</span>
        <Input name="displayName" className="h-12 border-2 border-neutral-300" placeholder="例：淡水門市" />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">設定密碼</span>
        <Input name="password" type="password" required minLength={8} className="h-12 border-2 border-neutral-300" autoComplete="new-password" />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">再輸入一次密碼</span>
        <Input name="passwordConfirm" type="password" required minLength={8} className="h-12 border-2 border-neutral-300" autoComplete="new-password" />
      </label>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" className="h-12 w-full bg-neutral-950 text-white" disabled={pending}>{pending ? '建立中…' : '建立 POS 帳號'}</Button>;
}
