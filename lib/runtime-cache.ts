import { getCache } from '@vercel/functions';
import { revalidateTag } from 'next/cache';
import type { CacheTag } from '@/lib/cache-tags';
import { toCacheJSON } from '@/lib/cache-serialize';

type MemoryEntry = { value: unknown; expiresAt: number };

const memoryStore = new Map<string, MemoryEntry>();

function tryGetCache() {
  try {
    return getCache({ namespace: 'furmosa-hq' });
  } catch {
    return null;
  }
}

/**
 * 區域 Runtime Cache（Vercel）＋本機記憶體後備。
 * 與 unstable_cache 疊加：跨 instance 熱讀可少打 DB。
 * 寫入前一律 toCacheJSON，避免 Decimal／Date 讓 SSR／RSC 失敗。
 */
export async function withRuntimeCache<T>(
  key: string,
  options: { ttlSeconds: number; tags: CacheTag[]; name?: string },
  loader: () => Promise<T>,
): Promise<T> {
  const cache = tryGetCache();

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

  const value = toCacheJSON(await loader());

  if (cache) {
    try {
      await cache.set(key, value, {
        ttl: options.ttlSeconds,
        tags: options.tags,
        name: options.name ?? key,
      });
    } catch {
      // 寫入失敗不影響回應
    }
  } else {
    memoryStore.set(key, {
      value,
      expiresAt: Date.now() + options.ttlSeconds * 1000,
    });
  }

  return value;
}

/** 同時失效 Next Data Cache tag 與 Runtime Cache tag */
export async function bustCacheTags(...tags: CacheTag[]) {
  for (const tag of tags) {
    revalidateTag(tag);
  }

  const cache = tryGetCache();
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
