/**
 * 四格漫畫 Rich Menu。
 *
 * ┌────────────┬────────────┐
 * │ 一起野放    │ 預約美容    │
 * │ 今天發生…  │ 漂亮一下    │
 * ├────────────┼────────────┤
 * │ 換罐計劃    │ 回家        │
 * │ 空罐別忘記  │ 還有很多故事│
 * └────────────┴────────────┘
 */

import { WORLD_THEME } from '@/lib/line/card-theme';
import {
  buildButtonMenuFlex,
  buildGroomingSoonMessages,
  buildHomeHubMessages,
  buildWorldHubMessages,
} from '@/lib/line/flex-hubs';
import { getLiffUrlIfConfigured } from '@/lib/line/liff-config';
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

/** 一起野放 → 只回選單卡（副標：探索新鮮事） */
export function buildComicRoamMessages(_registered = false): LineReplyMessage[] {
  return buildWorldHubMessages('chaos');
}

/** 預約美容 → 封面＋短文（很快就能約） */
export function buildComicGroomingMessages(): LineReplyMessage[] {
  return buildGroomingSoonMessages();
}

/** 換罐計劃主選單（五鍵；不依開戶狀態，熱路徑可零 DB） */
export function buildComicJarMessages(_registered = false): LineReplyMessage[] {
  return buildWorldHubMessages('jar');
}

/** 已開戶附加卡：Reply 後再 Push，不阻塞主選單 */
export function buildJarLiffCtaMessages(): LineReplyMessage[] {
  const url = getLiffUrlIfConfigured('refill');
  if (!url) return [];
  return [
    buildButtonMenuFlex({
      altText: '線上預購換罐',
      theme: WORLD_THEME.jar,
      title: '線上預購換罐',
      subtitle: '預約確認後，在這裡付換罐款、預購下一罐零食。',
      items: [
        {
          label: '線上預購換罐',
          action: { type: 'uri', uri: url },
          style: 'primary',
        },
      ],
    }),
  ];
}

/** 回家 → furmosa.com + IG，像回家不是點首頁 */
export function buildComicHomeMessages(_registered = false): LineReplyMessage[] {
  return buildHomeHubMessages();
}
