import { prisma } from '@/lib/prisma';
import { FALLBACK_PARTNER_STORES } from '@/lib/stores/partner-stores';
import { parseStoreAccessSegment } from '@/lib/stores/redeem-url';

export type VerifiedStoreAccess = {
  slug: string;
  name: string;
};

const FALLBACK_STORE_TOKENS: Record<string, string> = {
  zhuwo_zhonghe: '8k2m1x',
  zhuwo_banqiao: '4f9d7k',
  zhuwo_tucheng: '7p3n8q',
  niuniu: '5w9r2t',
  manlisa: '7m2n9p',
  pet99: '6h4j1k',
};

export async function verifyStoreAccessSegment(
  access: string,
): Promise<VerifiedStoreAccess | null> {
  const parsed = parseStoreAccessSegment(access);
  if (!parsed) return null;

  try {
    const row = await prisma.store.findUnique({
      where: { slug: parsed.slug },
      select: { slug: true, name: true, secretToken: true },
    });
    if (row && row.secretToken === parsed.secretToken) {
      return { slug: row.slug, name: row.name };
    }
  } catch {
    // fallback below
  }

  const fb = FALLBACK_PARTNER_STORES.find((s) => s.slug === parsed.slug);
  const fbToken = FALLBACK_STORE_TOKENS[parsed.slug];
  if (!fb || fbToken !== parsed.secretToken) return null;
  return { slug: fb.slug, name: fb.name };
}
