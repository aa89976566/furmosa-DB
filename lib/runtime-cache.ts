import { revalidateTag } from 'next/cache';
import type { CacheTag } from '@/lib/cache-tags';

type MemoryEntry = { value: unknown; expiresAt: number };

const memoryStore = new Map<string, MemoryEntry>();

/** 僅允許 JSON 可往返的純資料進入 Runtime Cache（避免 Date／Decimal／BigInt 搞壞 RSC） */
function toPlainJson<T>(value: T): T | null {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return null;
  }
}

async function tryGetCache() {
  try {
    const { getCache } = await import('@vercel/functions');
    return getCache({ namespace: 'furmosa-hq' });
  } catch {
    return null;
  }
}

/**
 * 區域 Runtime Cache（Vercel）＋本機記憶體後備。
 * 只應用於「已是純 JSON」的熱讀（合計、計數）；勿快取 Prisma 實體圖。
 */
export async function withRuntimeCache<T>(
  key: string,
  options: { ttlSeconds: number; tags: CacheTag[]; name?: string },
  loader: () => Promise<T>,
): Promise<T> {
  const cache = await tryGetCache();

  if (cache) {
    try {
      const hit = await cache.get(key);
      if (hit !== undefined && hit !== null) {
        return hit as T;
      }
    } catch {
      // 讀取失敗則直通 loader
    }
  } else {
    const mem = memoryStore.get(key);
    if (mem && mem.expiresAt > Date.now()) {
      return mem.value as T;
    }
  }

  const value = await loader();
  const plain = toPlainJson(value);
  if (plain === null) {
    return value;
  }

  if (cache) {
    try {
      await cache.set(key, plain, {
        ttl: options.ttlSeconds,
        tags: options.tags,
        name: options.name ?? key,
      });
    } catch {
      // 寫入失敗不影響回應
    }
  } else {
    memoryStore.set(key, {
      value: plain,
      expiresAt: Date.now() + options.ttlSeconds * 1000,
    });
  }

  // 回傳 plain，確保同一請求內後續也不帶 class instance
  return plain;
}

/** 同時失效 Next Data Cache tag 與 Runtime Cache tag */
export async function bustCacheTags(...tags: CacheTag[]) {
  for (const tag of tags) {
    try {
      revalidateTag(tag);
    } catch {
      // ignore
    }
  }

  const cache = await tryGetCache();
  if (cache) {
    try {
      await cache.expireTag(tags);
    } catch {
      // ignore
    }
  } else {
    memoryStore.clear();
  }
}
