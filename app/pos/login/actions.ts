'use server';

import { z } from 'zod';
import { loginMerchantWithPassword } from '@/lib/merchant-auth';
import { loginFailureMessage } from '@/lib/auth-errors';
import { resolvePosLoginDestination } from '@/lib/auth-redirect';

const schema = z.object({
  username: z.string().trim().min(1, '請輸入帳號'),
  password: z.string().min(1, '請輸入密碼'),
  next: z.string().optional(),
});

export type PosLoginState = {
  error?: string;
  values?: { username?: string };
  /** Full document navigation avoids Server Action redirect responses that some browsers reject. */
  redirectTo?: string;
};

export async function posLoginAction(
  _prev: PosLoginState,
  formData: FormData,
): Promise<PosLoginState> {
  try {
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

    // Returning normal action state is intentional. A thrown redirect after a
    // successful cookie write can be surfaced as an "unexpected response" by
    // the client, leaving the merchant on the error page even though login
    // succeeded. The client performs a document navigation after this state.
    return { redirectTo: resolvePosLoginDestination(parsed.data.next) };
  } catch (err) {
    console.error('[pos/login]', err);
    return {
      error: loginFailureMessage(err),
      values: { username: String(formData.get('username') ?? '') },
    };
  }
}
