import type { WorldHubId } from '@/lib/line/brand-worlds';

/**
 * 漫畫分頁色票：白底、墨線、大量留白。
 * 禁止漸層、禁止企業儀表板灰。
 */

export type WorldTheme = {
  accent: string;
  soft: string;
  card: string;
  ink: string;
  muted: string;
  hero: string;
  rule: string;
};

export const WORLD_THEME: Record<WorldHubId, WorldTheme> = {
  /** 換罐：玻璃綠，瓶子感 */
  jar: {
    accent: '#1F5C45',
    soft: '#EEF6F1',
    card: '#FFFFFF',
    ink: '#14241C',
    muted: '#5A6B62',
    hero: '#D9EDE3',
    rule: '#C5DDD0',
  },
  /** 野放：暖橘墨，外面 comparably rebellious */
  chaos: {
    accent: '#B84A1F',
    soft: '#FFF6EE',
    card: '#FFFFFF',
    ink: '#2A1810',
    muted: '#7A5744',
    hero: '#F7E0C8',
    rule: '#E8C9A8',
  },
  /** 回家：沉穩草木，像玄關燈 */
  wild: {
    accent: '#2F4A34',
    soft: '#F1F5F0',
    card: '#FFFFFF',
    ink: '#152018',
    muted: '#5C6A5E',
    hero: '#DCE8DC',
    rule: '#C2D0C2',
  },
};

/** 預約美容（coming soon）單獨色——浴室泡沫感 */
export const GROOMING_THEME: WorldTheme = {
  accent: '#3D5A80',
  soft: '#F0F4F8',
  card: '#FFFFFF',
  ink: '#1B2838',
  muted: '#5C6B7A',
  hero: '#D9E4F0',
  rule: '#C5D2E0',
};

export const BRAND_SURFACE = {
  page: '#FAFAF8',
  ink: '#1A1A1A',
  muted: '#666666',
} as const;
