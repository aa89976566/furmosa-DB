'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { loginWithPassword } from '@/lib/auth';

const schema = z.object({
  email: z.string().email('請輸入有效的 Email'),
  password: z.string().min(6, '密碼至少 6 字元'),
  next: z.string().optional(),
});

export type LoginState = {
  error?: string;
  values?: { email?: string };
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next'),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? '輸入有誤',
      values: { email: String(formData.get('email') ?? '') },
    };
  }
  const result = await loginWithPassword(parsed.data.email, parsed.data.password);
  if (!result.ok) {
    return { error: result.error, values: { email: parsed.data.email } };
  }
  const next = parsed.data.next && parsed.data.next.startsWith('/') ? parsed.data.next : '/dashboard';
  redirect(next);
}
