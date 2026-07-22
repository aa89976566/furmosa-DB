'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { loginMerchantWithPassword } from '@/lib/merchant-auth';

const schema = z.object({
  username: z.string().trim().min(1, '請輸入帳號'),
  password: z.string().min(1, '請輸入密碼'),
  next: z.string().optional(),
});

export type PosLoginState = {
  error?: string;
  values?: { username?: string };
};

export async function posLoginAction(
  _prev: PosLoginState,
  formData: FormData,
): Promise<PosLoginState> {
  const parsed = schema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
    next: formData.get('next'),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? '輸入有誤',
      values: { username: String(formData.get('username') ?? '') },
    };
  }

  const result = await loginMerchantWithPassword(
    parsed.data.username,
    parsed.data.password,
  );
  if (!result.ok) {
    return {
      error: result.error,
      values: { username: parsed.data.username },
    };
  }

  const next =
    parsed.data.next &&
    parsed.data.next.startsWith('/pos') &&
    !parsed.data.next.startsWith('/pos/login')
      ? parsed.data.next
      : '/pos';
  redirect(next);
}
