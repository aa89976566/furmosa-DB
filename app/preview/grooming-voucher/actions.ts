'use server';

import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { isNextRedirect } from '@/lib/is-next-redirect';
import {
  evaluateLoginAttempt,
  evaluateLogout,
  GROOMING_PREVIEW_PATH,
  readPreviewAuthEnv,
} from '@/lib/grooming-voucher-preview/preview-auth';

function isNextNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    String((error as { digest?: string }).digest).includes('NOT_FOUND')
  );
}

function headerGet(name: string): string | null {
  return headers().get(name);
}

export async function loginAction(formData: FormData) {
  try {
    const decision = await evaluateLoginAttempt({
      env: readPreviewAuthEnv(process.env),
      username: String(formData.get('username') ?? ''),
      password: String(formData.get('password') ?? ''),
      headerGet,
      nowMs: Date.now(),
    });
    if (decision.type === 'not_found') notFound();
    if (decision.type === 'reject') {
      redirect(`${GROOMING_PREVIEW_PATH}?e=1`);
    }
    cookies().set(decision.cookie.name, decision.cookie.value, decision.cookie.options);
    redirect(decision.redirectTo);
  } catch (error) {
    if (isNextRedirect(error) || isNextNotFound(error)) throw error;
    redirect(`${GROOMING_PREVIEW_PATH}?e=1`);
  }
}

export async function logoutAction() {
  try {
    const decision = evaluateLogout({ headerGet });
    if (decision.type === 'reject') {
      redirect(GROOMING_PREVIEW_PATH);
    }
    cookies().set(decision.cookie.name, decision.cookie.value, decision.cookie.options);
    redirect(decision.redirectTo);
  } catch (error) {
    if (isNextRedirect(error) || isNextNotFound(error)) throw error;
    redirect(GROOMING_PREVIEW_PATH);
  }
}
