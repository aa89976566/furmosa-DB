import type { WorldHubId } from '@/lib/line/brand-worlds';

/**
 * 漫畫分頁色票：對齊系統紫墨／洋紅／橙／金黃。
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
  /** 換罐：品牌洋紅 */
  jar: {
    accent: '#C62C60',
    soft: '#F9EEF2',
    card: '#FFFFFF',
    ink: '#2F1B41',
    muted: '#6B5B7A',
    hero: '#F3D5E0',
    rule: '#E8C5D2',
  },
  /** 野放：活力橙 */
  chaos: {
    accent: '#FA8617',
    soft: '#FFF4E8',
    card: '#FFFFFF',
    ink: '#2F1B41',
    muted: '#8A6A4A',
    hero: '#FDE0B8',
    rule: '#F0C890',
  },
  /** 回家：紫墨沉穩 */
  wild: {
    accent: '#2F1B41',
    soft: '#F3EFF7',
    card: '#FFFFFF',
    ink: '#2F1B41',
    muted: '#6B5B7A',
    hero: '#DDD4E8',
    rule: '#C8BDD6',
  },
};

/** 預約美容：金黃亮點 */
export const GROOMING_THEME: WorldTheme = {
  accent: '#F9C823',
  soft: '#FFF8E6',
  card: '#FFFFFF',
  ink: '#2F1B41',
  muted: '#7A6A4A',
  hero: '#FBE9A8',
  rule: '#EFD889',
};

export const BRAND_SURFACE = {
  page: '#F6F4F8',
  ink: '#2F1B41',
  muted: '#6B5B7A',
} as const;
