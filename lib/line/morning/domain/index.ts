export * from '@/lib/line/morning/domain/types';
export * from '@/lib/line/morning/domain/consent';
export * from '@/lib/line/morning/domain/frequency';
export * from '@/lib/line/morning/domain/source-contract';
export * from '@/lib/line/morning/domain/decision';
export * from '@/lib/line/morning/domain/optin';

import {
  isActiveDomainContentMode,
  toDomainContentMode,
} from '@/lib/line/morning/domain/consent';
import {
  isActiveDomainFrequency,
  toDomainFrequency,
} from '@/lib/line/morning/domain/frequency';

/** 偏好是否為活躍訂閱（domain 層；OFF／UNSET／未知 → 否） */
export function isDomainActivelySubscribed(input: {
  contentMode: string | null | undefined;
  frequency: string | null | undefined;
  pausedAt?: Date | null;
}): boolean {
  if (input.pausedAt) return false;
  const mode = toDomainContentMode(input.contentMode);
  const freq = toDomainFrequency(input.frequency);
  return isActiveDomainContentMode(mode) && isActiveDomainFrequency(freq);
}
