/**
 * Frequency：DB 保留 daily|weekday|weekly|off|unset
 * Domain typed alias → DAILY|WEEKDAYS|WEEKLY|OFF|UNSET
 * 不做重型 backfill 欄位。
 */

import type { MorningDomainFrequency } from '@/lib/line/morning/domain/types';
import { MORNING_ACTIVE_DOMAIN_FREQUENCIES } from '@/lib/line/morning/domain/types';

/** DB 既有值（不變） */
export const MORNING_STORAGE_FREQUENCIES = [
  'daily',
  'weekday',
  'weekly',
  'off',
  'unset',
] as const;
export type MorningStorageFrequency =
  (typeof MORNING_STORAGE_FREQUENCIES)[number];

const STORAGE_TO_DOMAIN: Record<string, MorningDomainFrequency> = {
  daily: 'DAILY',
  DAILY: 'DAILY',
  weekday: 'WEEKDAYS',
  WEEKDAYS: 'WEEKDAYS',
  weekdays: 'WEEKDAYS',
  weekly: 'WEEKLY',
  WEEKLY: 'WEEKLY',
  off: 'OFF',
  OFF: 'OFF',
  unset: 'UNSET',
  UNSET: 'UNSET',
};

const DOMAIN_TO_STORAGE: Record<MorningDomainFrequency, MorningStorageFrequency> =
  {
    DAILY: 'daily',
    WEEKDAYS: 'weekday',
    WEEKLY: 'weekly',
    OFF: 'off',
    UNSET: 'unset',
  };

/** 未知 → UNSET（fail-closed） */
export function toDomainFrequency(
  raw: string | null | undefined,
): MorningDomainFrequency {
  if (raw == null || raw === '') return 'UNSET';
  return STORAGE_TO_DOMAIN[raw] ?? 'UNSET';
}

export function toStorageFrequency(
  freq: MorningDomainFrequency,
): MorningStorageFrequency {
  return DOMAIN_TO_STORAGE[freq];
}

export function isActiveDomainFrequency(
  freq: MorningDomainFrequency,
): boolean {
  return (MORNING_ACTIVE_DOMAIN_FREQUENCIES as readonly string[]).includes(freq);
}
