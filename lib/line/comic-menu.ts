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

import {
  buildGroomingSoonMessages,
  buildHomeHubMessages,
  buildWorldHubMessages,
} from '@/lib/line/flex-hubs';
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

/** 預約美容 → 封面＋短文（尚未開放線上預約） */
export function buildComicGroomingMessages(): LineReplyMessage[] {
  return buildGroomingSoonMessages();
}

/** 換罐計劃主選單（三主鍵＋了解更多；換罐走伺服器閘道） */
export function buildComicJarMessages(_registered = false): LineReplyMessage[] {
  return buildWorldHubMessages('jar');
}

/**
 * @deprecated 換罐改由 jd=jar_refill 伺服器閘道後再給 LIFF。
 * 保留空實作以免舊呼叫端炸掉。
 */
export function buildJarLiffCtaMessages(): LineReplyMessage[] {
  return [];
}

/** 回家 → furmosa.com + IG，像回家不是點首頁 */
export function buildComicHomeMessages(_registered = false): LineReplyMessage[] {
  return buildHomeHubMessages();
}
