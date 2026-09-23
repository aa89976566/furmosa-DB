export const FINANCE_CHANNELS = [
  'website',
  'buyout',
  'consignment',
  'group_buy',
  'pos',
  'refill',
] as const;

export type FinanceChannel = (typeof FINANCE_CHANNELS)[number];

export const FINANCE_CHANNEL_LABEL: Record<FinanceChannel, string> = {
  website: '官網',
  buyout: '買斷',
  consignment: '寄賣',
  group_buy: '團購',
  pos: 'POS',
  refill: '換罐',
};

export function isFinanceChannel(value: string): value is FinanceChannel {
  return (FINANCE_CHANNELS as readonly string[]).includes(value);
}

/** 官網與買斷沒有另外的通路夥伴抽成欄位。有實際訂單時，分潤是已知道的 0。 */
export function structuralChannelShareCents(channel: FinanceChannel): number | null {
  if (channel === 'website' || channel === 'buyout') return 0;
  return null;
}

export const RECOGNIZED_REFILL_STATUSES = [
  'paid_waiting_return',
  'old_container_verified',
  'completed',
  'awaiting_extra_payment',
] as const;

export const CASH_WEEK_COUNT = 13;
