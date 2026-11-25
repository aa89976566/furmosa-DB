'use server';

import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

const categories = new Set(['健康在世', '高齡／重症／長照／安寧', '離世天使']);

function futureDate(value: string, timed: boolean) {
  const pattern = timed ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/;
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
  const email = field('email').toLowerCase();
  const first = field('first');
  const second = field('second');
  const delivery = field('delivery');
  if (field('website')) return { message: '請重新整理頁面後再試。' };
  if (
    !categories.has(category) || !name || name.length > 80 ||
    email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    (format !== 'live' && format !== 'written') ||
    (format === 'live' && (!futureDate(first, true) || !futureDate(second, true) || first === second)) ||
    (format === 'written' && !futureDate(delivery, false))
  ) return { message: '請確認聯絡資料，並填寫未來日期。即時溝通需提供兩個不同時段。' };
  const method = format === 'live' ? '即時線上' : '非即時圖文';
  const timing = format === 'live' ? '候選時段（台灣時間）：' + first + '、' + second : '期望交付日期：' + delivery;
  const taskId = 'BOOK-CYN-' + createHash('sha256')
    .update(JSON.stringify([email, category, format, timing])).digest('hex').slice(0, 24);
  try {
    await prisma.task.upsert({
      where: { taskId },
      update: {},
      create: {
        taskId,
        title: '西亞預約申請｜' + category + '・' + method,
        type: 'customer_service',
        status: 'todo',
        description: '聯絡人：' + name + '\nEmail：' + email + '\n' + timing,
      },
    });
  } catch {
    return { message: '暫時無法送出，請稍後重試。' };
  }
  redirect('/book/cynthia?submitted=1');
}
