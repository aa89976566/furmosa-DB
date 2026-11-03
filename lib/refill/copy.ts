/** 顧客／店家可懂文案；勿暴露 webhook、token、internal error */

export const REFILL_COPY = {
  ctaWantRefill: '我要換罐',
  selectPet: '選擇毛孩',
  selectBooking: '想去哪一次美容預約換罐？',
  exchangePrice: '續罐 NT$99｜記得帶空罐',
  firstPrice: '第一罐 NT$129｜不用帶空罐',
  confirmPay: '前往付款',
  confirmPayAmount: (n: number) => `付款 NT$${n}`,
  payDone: '付款完成啦',
  rememberEmptyJar: '續罐記得帶空罐到店裡',
  giveToStaff: '到店後給店員確認',
  waitingStore: '等你到店領取',
  refillDone: '換罐完成',
  confirmingPayment: '正在確認付款',
  waitingAtStore: '等待到店領取',
  noExchangeJar: '目前沒有可換的空罐，這次先選第一罐 NT$129',
  alreadyPaid: '這筆已經付過款，不用再付一次',
  noBooking: '目前找不到可以換罐的美容預約',
  bookingNotConfirmed: '這筆預約還沒確認，確認後就能付款',
  noReturnableJar: '目前沒有可回收的空罐',
  serialUsed: '這個序號已經用過囉',
  wrongStore: (storeName: string) => `這筆要到 ${storeName} 領取`,
  genericError: '剛剛有點卡，請稍後再試一次',
  missingJarKeep: '已幫你保留，下次帶空罐再來領',
  missingJarTopup: '補付 NT$30 後就能領取',
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
    default:
      return REFILL_COPY.genericError;
  }
}
