import { normalizeJarCode } from '@/lib/jar-exchange/codes';

export type RefillFulfillmentInput = {
  pickupQuantity: number;
  returnedSerials: string[];
  idempotencyKey: string;
};

export function parseRefillFulfillmentInput(value: unknown): RefillFulfillmentInput {
  if (!value || typeof value !== 'object') throw new Error('提交內容格式不正確');
  const raw = value as Record<string, unknown>;
  if (!Number.isInteger(raw.pickupQuantity) || Number(raw.pickupQuantity) < 1 || Number(raw.pickupQuantity) > 100) {
    throw new Error('本次領取數量須介於 1 到 100');
  }
  if (!Array.isArray(raw.returnedSerials) || raw.returnedSerials.length > 100 || raw.returnedSerials.some((item) => typeof item !== 'string')) {
    throw new Error('空罐序號內容格式不正確');
  }
  const idempotencyKey = typeof raw.idempotencyKey === 'string' ? raw.idempotencyKey.trim() : '';
  if (idempotencyKey.length < 8 || idempotencyKey.length > 120) {
    throw new Error('操作識別碼格式不正確');
  }
  const returnedSerials = (raw.returnedSerials as string[]).map(normalizeJarCode);
  if (new Set(returnedSerials).size !== returnedSerials.length) {
    throw new Error('同一個空罐序號不能重複輸入');
  }
  if (returnedSerials.some((serial) => !/^\d{8}$/.test(serial))) {
    throw new Error('空罐序號須為 8 位數字');
  }
  return {
    pickupQuantity: Number(raw.pickupQuantity),
    returnedSerials,
    idempotencyKey,
  };
}
