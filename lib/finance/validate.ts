import { isFinanceChannel, type FinanceChannel } from '@/lib/finance/channels';
import type { MarginThresholds } from '@/lib/finance/formula';

export function parseTwdToCents(
  raw: unknown,
): { ok: true; cents: number | null } | { ok: false; message: string } {
  if (raw == null) return { ok: true, cents: null };
  const text = String(raw).trim().replace(/,/g, '').replace(/^NT\$/i, '');
  if (text === '') return { ok: true, cents: null };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return { ok: false, message: '請輸入 0 以上的金額，最多兩位小數。空白代表尚未填寫，不會當成 0。' };
  }
  const [whole, fraction = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
  if (!Number.isSafeInteger(cents) || cents > 1_000_000_000_00) {
    return { ok: false, message: '金額超過可儲存範圍。' };
  }
  return { ok: true, cents };
}

export function parsePercentToBps(
  raw: unknown,
): { ok: true; bps: number } | { ok: false; message: string } {
  const text = String(raw ?? '').trim().replace(/%$/, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return { ok: false, message: '門檻請輸入 0 到 100 的百分比，最多兩位小數。' };
  }
  const [whole, fraction = ''] = text.split('.');
  const bps = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
  if (bps > 10000) return { ok: false, message: '門檻不能超過 100%。' };
  return { ok: true, bps };
}

export function parseThresholds(
  greenRaw: unknown,
  yellowRaw: unknown,
): { ok: true; thresholds: MarginThresholds } | { ok: false; message: string } {
  const green = parsePercentToBps(greenRaw);
  if (!green.ok) return green;
  const yellow = parsePercentToBps(yellowRaw);
  if (!yellow.ok) return yellow;
  if (green.bps <= yellow.bps) {
    return { ok: false, message: '綠燈門檻必須高於黃燈門檻。' };
  }
  return { ok: true, thresholds: { greenMinBps: green.bps, yellowMinBps: yellow.bps } };
}

export function parseChannel(raw: unknown): FinanceChannel | null {
  const value = String(raw ?? '');
  return isFinanceChannel(value) ? value : null;
}

export function parseWeekIndex(raw: unknown): number | null {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 12) return null;
  return value;
}
