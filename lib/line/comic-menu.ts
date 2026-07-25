/**
 * 四格漫畫 Rich Menu 按鈕邏輯
 *
 * ┌────────────┬────────────┐
 * │ 一起野放    │ 預約美容    │
 * │ 今天發生…  │ 漂亮一下    │
 * ├────────────┼────────────┤
 * │ 換罐計畫    │ 回家        │
 * │ 空罐別忘記  │ 還有很多故事│
 * └────────────┴────────────┘
 */

import { FURMOSA_BRAND_LINKS } from '@/lib/line/brand-links';
import { buildWorldHubMessages } from '@/lib/line/flex-hubs';
import { listPartnerStoresFromDb } from '@/lib/stores/partner-stores';
import { formatLineStorePickerLabel } from '@/lib/coupons/constants';
import type { LineReplyMessage } from '@/lib/line/reply';

export type ComicMenuKind = 'roam' | 'grooming' | 'jar' | 'home';

export function parseComicMenuText(text: string): ComicMenuKind | null {
  const t = text.trim();
  if (/^(?:一起野放|野放一下)$/.test(t)) return 'roam';
  if (/^(?:預約美容|漂亮一下)$/.test(t)) return 'grooming';
  if (/^(?:換罐計畫|換罐計劃)$/.test(t)) return 'jar';
  if (/^(?:回家|還有很多故事)$/.test(t)) return 'home';
  return null;
}

/** 一起野放 → 新鮮事／活動（一起搞事世界） */
export function buildComicRoamMessages(registered: boolean): LineReplyMessage[] {
  return [
    {
      type: 'text',
      text: '一起野放 🐾\n今天又有什麼事在發生？從下面挑一張看。',
    },
    ...buildWorldHubMessages('chaos', { registered }),
  ];
}

/** 預約美容 → 合作店導引（線上預約尚未全開） */
export async function buildComicGroomingMessages(): Promise<LineReplyMessage[]> {
  const stores = await listPartnerStoresFromDb();
  const storeLines = stores
    .slice(0, 8)
    .map((s) => `· ${formatLineStorePickerLabel(s.name, s.slug)}`)
    .join('\n');

  return [
    {
      type: 'text',
      text: [
        '預約美容 ✂️',
        '漂亮一下，先找常去的合作店。',
        '',
        '線上預約還在鋪路中；現在可直接聯繫店家，或先完成換罐開戶綁店。',
        '',
        '合作店家：',
        storeLines || '（稍後再看野放中 → 合作店家）',
      ].join('\n'),
    },
  ];
}

/** 換罐計畫 → 制度世界 */
export function buildComicJarMessages(registered: boolean): LineReplyMessage[] {
  return buildWorldHubMessages('jar', { registered });
}

/** 回家 → 官網／社群／故事（野放中） */
export function buildComicHomeMessages(registered: boolean): LineReplyMessage[] {
  const web = FURMOSA_BRAND_LINKS.website();
  return [
    {
      type: 'text',
      text: `回家了 🏠\n還有很多故事。官網也在這：${web}`,
    },
    ...buildWorldHubMessages('wild', { registered }),
  ];
}
