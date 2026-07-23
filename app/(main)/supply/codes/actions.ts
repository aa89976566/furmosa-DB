'use server';

import { generateJarCodesBatch } from '@/app/(main)/jar-exchange/actions';

/** @deprecated 請使用換罐會員序號管理（僅 8 位數字） */
export async function generateReturnCodesBatch(
  ...args: Parameters<typeof generateJarCodesBatch>
) {
  return generateJarCodesBatch(...args);
}