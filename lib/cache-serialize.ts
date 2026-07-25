/**
 * 將 Prisma Decimal / Date / BigInt 轉成可進 Runtime Cache 與 RSC 的 plain JSON。
 * 不用 JSON.stringify replacer（Decimal.toJSON 會先變成字串），改為深度走訪。
 */
export function toCacheJSON<T>(value: T): T {
  return walk(value) as T;
}

function isDecimalLike(v: object): v is { toNumber: () => number } {
  return (
    typeof (v as { toNumber?: unknown }).toNumber === 'function' &&
    typeof (v as { toFixed?: unknown }).toFixed === 'function'
  );
}

function walk(value: unknown): unknown {
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return value;

  if (typeof value === 'object') {
    if (isDecimalLike(value)) {
      try {
        return value.toNumber();
      } catch {
        return Number(String(value));
      }
    }
    if (Array.isArray(value)) return value.map(walk);

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = walk(v);
    }
    return out;
  }

  return value;
}
