/** 顧客／店家可懂文案；勿暴露 webhook、token、internal error */

export const REFILL_COPY = {
  ctaWantRefill: '我要換罐',
  selectPet: '選擇毛孩',
  selectBooking: '選擇美容預約',
  flavourTitle: '想換哪一味？',
  flavourHint: '先選給店家參考，實際口味以取貨當日現貨為準。',
  flavourDecideAtStore: '到店再選',
  payKeepsEntitlement: '這次付款會保留你的領取資格，口味到店再確認。',
  exchangePrice: '這次換罐 NT$99',
  firstPrice: '這次首罐 NT$129',
  confirmPay: '確認付款',
  confirmPayAmount: (n: number) => `確認付款 NT$${n}`,
  payDone: '付款完成',
  paySuccessPreferred: (flavourLabel: string) =>
    `付款完成。你希望的是${flavourLabel}；若當日售完，可以直接改選店內現貨，不用重新付款。`,
  paySuccessDecideAtStore: '付款完成。到店後可從現有口味中直接挑一罐。',
  rememberEmptyJar: '記得帶空罐',
  giveToStaff: '到店交給店員',
  waitingStore: '等待店家確認',
  refillDone: '已完成換罐',
  confirmingPayment: '正在確認付款狀態',
  waitingAtStore: '等待到店換罐',
  noExchangeJar: '目前沒有可使用的空罐紀錄，這次請選首罐 NT$129。',
  alreadyPaid: '這筆換罐已經付款，不需要再付一次。',
  noBooking: '目前找不到可換罐的預約。',
  bookingNotConfirmed: '這筆預約尚未確認，確認後才能付款。',
  noReturnableJar: '您目前沒有可回收的罐子。',
  serialUsed: '這個序號已經使用過。',
  wrongStore: (storeName: string) => `這筆訂單只能在${storeName}領取。`,
  genericError: '系統忙碌中，請稍後再試。',
  missingJarKeep: '已幫您保留，下次帶空罐再來領取。',
  missingJarTopup: '請線上補付差額 NT$30 後再領取。',
  preferredNotReserved: '希望口味不等於庫存保留',
} as const;

export function mapRefillErrorToCopy(code: string, storeName?: string): string {
  switch (code) {
    case 'NO_BOOKING':
      return REFILL_COPY.noBooking;
    case 'BOOKING_NOT_CONFIRMED':
      return REFILL_COPY.bookingNotConfirmed;
    case 'NO_RETURNABLE_JAR':
      return REFILL_COPY.noReturnableJar;
    case 'ALREADY_PAID':
    case 'ACTIVE_ORDER_EXISTS':
      return REFILL_COPY.alreadyPaid;
    case 'SERIAL_USED':
      return REFILL_COPY.serialUsed;
    case 'WRONG_STORE':
      return REFILL_COPY.wrongStore(storeName ?? '指定店家');
    case 'OUT_OF_STOCK':
      return '此口味目前沒有庫存，請改選其他現貨。';
    default:
      return REFILL_COPY.genericError;
  }
}

/** LINE／LIFF 付款成功文案（preferredLabel 為 null＝到店再選） */
export function buildPaidNotifyText(input: {
  petName: string;
  merchantName: string;
  amount: number;
  dateLine: string;
  orderIdShort: string;
  preferredLabel: string | null;
  isExchange: boolean;
}): string {
  const flavourLine = input.preferredLabel
    ? `付款完成。你希望的是【${input.preferredLabel}】；實際口味以取貨當日店內現貨為準，售完可直接改選，不用重新付款。`
    : REFILL_COPY.paySuccessDecideAtStore;

  const lines = [
    flavourLine,
    '',
    `領取店家：${input.merchantName}`,
    `資格編號：${input.orderIdShort}`,
    `金額：NT$${input.amount}`,
    `預約：${input.dateLine}`,
    REFILL_COPY.preferredNotReserved,
  ];
  if (input.isExchange) {
    lines.push(REFILL_COPY.rememberEmptyJar);
  }
  return lines.join('\n');
}
