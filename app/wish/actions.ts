'use server';
import { headers } from 'next/headers';
import { isIP } from 'node:net';
import { submitWish, WishError } from '@/lib/guide/wishes';
import { wishStore } from '@/lib/guide/wish-store';

export type WishFormState = { ok: boolean; message: string };
export async function sendWish(_previous: WishFormState, form: FormData): Promise<WishFormState> {
  if (process.env.FURMOSA_WISHES_ENABLED !== 'true') return { ok: false, message: '許願池尚未開放，請稍後再試。' };
  if (String(form.get('website') ?? '')) return { ok: false, message: '無法送出，請重新整理後再試。' };
  const requestHeaders = await headers();
  // Explicitly configure a header overwritten by the deployment's trusted proxy.
  // Do not silently trust a visitor-supplied Forwarded/X-Forwarded-For header.
  const ipHeader = process.env.WISH_TRUSTED_IP_HEADER?.toLowerCase();
  const address = ipHeader ? requestHeaders.get(ipHeader)?.trim() ?? '' : '';
  if (!isIP(address)) return { ok: false, message: '目前無法送出，請稍後再試。' };
  try {
    await submitWish({ species: form.get('species'), requestText: form.get('requestText'), lineId: form.get('lineId') },
      String(form.get('token') ?? ''), address,
      { enabled: true, secret: process.env.WISH_FORM_SECRET ?? '', now: Date.now() }, wishStore);
    return { ok: true, message: '收到你的許願！匠寵確認需求後，會使用你留下的 LINE ID 加好友聯繫。' };
  } catch (error) {
    const code = error instanceof WishError ? error.message : '';
    const message = code === 'INVALID_LINE_ID' ? '請填寫 LINE ID，使用 4–20 個英文字母、數字、點、底線或連字號。' :
      code === 'INVALID_INPUT' ? '請確認物種、想找的東西與 LINE ID 都已填寫。' :
      code === 'RATE_LIMITED' ? '今天的許願次數已達上限，請明天再試。' :
      ['EXPIRED_TOKEN', 'INVALID_TOKEN'].includes(code) ? '表單已逾時，請重新整理後再送出。' :
      '這次沒有送出成功，請稍後再試。';
    return { ok: false, message };
  }
}
