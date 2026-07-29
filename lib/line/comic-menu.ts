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
export function buildComicRoamMessages(registered: boolean): LineReplyMessage[] {
  return buildWorldHubMessages('chaos', { registered });
}

/** 預約美容 → 封面＋短文（很快就能約） */
export function buildComicGroomingMessages(): LineReplyMessage[] {
  return buildGroomingSoonMessages();
}

/** 換罐計劃 → 瓶子是主角；已開戶且設定 LIFF 時附加「我要換罐」 */
export function buildComicJarMessages(registered: boolean): LineReplyMessage[] {
  const msgs = buildWorldHubMessages('jar', { registered });
  if (registered) {
    const url = getLiffUrlIfConfigured('refill');
    if (url) {
      msgs.push(
        buildButtonMenuFlex({
          altText: '我要換罐',
          theme: WORLD_THEME.jar,
          title: '我要換罐',
          subtitle: '預約確認後，可直接線上付換罐款給匠寵。',
          items: [
            {
              label: '我要換罐',
              action: { type: 'uri', uri: url },
              style: 'primary',
            },
          ],
        }),
      );
    }
  }
  return msgs;
}

/** 回家 → furmosa.com + IG，像回家不是點首頁 */
export function buildComicHomeMessages(_registered: boolean): LineReplyMessage[] {
  return buildHomeHubMessages();
}
