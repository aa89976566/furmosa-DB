import type { WorldHubId } from '@/lib/line/brand-worlds';

/** 卡片式設計語言：Wallet / Notion / Switch 感，非灰底功能表 */

export type WorldTheme = {
  /** 世界主色 */
  accent: string;
  /** 柔和底 */
  soft: string;
  /** 卡片白 */
  card: string;
  /** 主標題 */
  ink: string;
  /** 副標 */
  muted: string;
  /** 插畫區底 */
  hero: string;
  /** 分隔／邊 */
  rule: string;
};

export const WORLD_THEME: Record<WorldHubId, WorldTheme> = {
  jar: {
    accent: '#2D6A4F',
    soft: '#F3Faf6',
    card: '#FFFFFF',
    ink: '#1A2E24',
    muted: '#5C6B63',
    hero: '#D8F3DC',
    rule: '#B7E4C7',
  },
  chaos: {
    accent: '#C45C26',
    soft: '#FFF8F0',
    card: '#FFFDF8',
    ink: '#3D2415',
    muted: '#7A5A40',
    hero: '#FFE8CC',
    rule: '#F0C987',
  },
  wild: {
    accent: '#3A5A40',
    soft: '#F4F7F2',
    card: '#FFFFFF',
    ink: '#1E2A1F',
    muted: '#5E6B5F',
    hero: '#E6F0E4',
    rule: '#C5D5C3',
  },
};

export const BRAND_SURFACE = {
  page: '#F7F3EC',
  ink: '#1F1A14',
  muted: '#6B6358',
} as const;
