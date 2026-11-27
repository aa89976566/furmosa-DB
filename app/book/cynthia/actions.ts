'use server';

import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';

const variants = new Map([
  ['健康在世', { live: '65121055637881', written: '65121055670649' }],
  ['高齡／重症／長照／安寧', { live: '65121055703417', written: '65121055736185' }],
  ['離世天使', { live: '65121055768953', written: '65121055801721' }],
]);

function futureDate(value: string, timed: boolean) {
  const pattern = timed ? /^\d{4}-\d{2}-\d{2}T\d{2}:(?:00|30)$/ : /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(value)) return false;
  const time = value + (timed ? '' : 'T23:59');
  const localTimestamp = Date.parse(time + 'Z');
  return Number.isFinite(localTimestamp) &&
    new Date(localTimestamp).toISOString().slice(0, 16) === time &&
    localTimestamp - 8 * 3600000 > Date.now();
}

export async function submitBooking(form: FormData) {
  const field = (key: string) => String(form.get(key) ?? '').trim();
  const category = field('category');
  const format = field('format');
  const name = field('name');
  const lineId = field('lineId');
  const first = field('first');
  const second = field('second');
  const delivery = field('delivery');
  if (field('website')) return { message: '請重新整理頁面後再試。' };
  const service = variants.get(category);
  if (
    !service || !name || name.length > 80 ||
    !lineId || !/^[a-zA-Z0-9._-]{1,64}$/.test(lineId) ||
    (format !== 'live' && format !== 'written') ||
    (format === 'live' && (!futureDate(first, true) || !futureDate(second, true) || first === second)) ||
    (format === 'written' && !futureDate(delivery, false))
  ) return { message: '請確認聯絡資料，並填寫未來日期。即時溝通需提供兩個不同的時段，時間以 30 分鐘為單位。' };
  const method = format === 'live' ? '即時線上' : '非即時圖文';
  const timing = format === 'live' ? '候選時段（台灣時間）：' + first + '、' + second : '期望交付日期：' + delivery;
  const taskId = 'BOOK-CYN-' + createHash('sha256')
    .update(JSON.stringify([lineId.toLowerCase(), category, format, timing])).digest('hex').slice(0, 24);
  try {
    await prisma.task.upsert({
      where: { taskId },
      update: {},
      create: {
        taskId,
        title: '西亞預約申請｜待付款｜' + category + '・' + method,
        type: 'customer_service',
        status: 'todo',
        description: '聯絡人：' + name + '\nLINE ID：' + lineId + '\n' + timing + '\n確認 Shopify 訂單已付款且預約編號相符後，再透過 LINE 聯繫。',
      },
    });
  } catch {
    return { message: '暫時無法送出，請稍後重試。' };
  }
  const checkout = new URL('https://furmosa.com/cart/' + service[format] + ':1');
  const properties = { '預約編號': taskId };
  checkout.searchParams.set('properties', Buffer.from(JSON.stringify(properties)).toString('base64url'));
  return { checkoutUrl: checkout.toString(), reference: taskId };

}
