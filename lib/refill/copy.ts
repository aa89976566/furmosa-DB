/** 顧客／店家可懂文案；勿暴露 webhook、token、internal error */

export const REFILL_COPY = {
  ctaWantRefill: '我要換罐',
  selectPet: '選擇毛孩',
  selectBooking: '選擇美容預約',
  exchangePrice: '這次換罐 NT$99',
  firstPrice: '這次首罐 NT$129',
  confirmPay: '確認付款',
  confirmPayAmount: (n: number) => `確認付款 NT$${n}`,
  payDone: '付款完成',
  rememberEmptyJar: '記得帶空罐',
  giveToStaff: '到店交給店員',
  waitingStore: '等待店家確認',
  refillDone: '已完成換罐',
  confirmingPayment: '正在確認付款狀態',
  waitingAtStore: '等待到店換罐',
  noExchangeJar: '目前沒有可使用的空罐紀錄，這次請選首罐 NT$129。',
  alreadyPaid: '這筆換罐已經付款，不需要再付一次。',
  noBooking:
    '目前還沒有可換罐的美容預約。\n這一步交給合作店家確認就好，線上還不能直接約。',
  noBookingNext:
    '請先跟合作店家約好、等店家確認後，再回這裡付換罐款。\n別急著再付一次，我們先把預約對起來。',
  viewPartnerStores: '查看合作店家',
  backToJarMenu: '回到換罐選單',
  bookingNotConfirmed: '這筆預約店家還沒確認，確認後才能付款。',
  noReturnableJar: '目前沒有可回收的空罐。',
  serialUsed: '這個序號已經使用過。',
  wrongStore: (storeName: string) => `這筆訂單只能在${storeName}領取。`,
  genericError: '現在有點忙，請稍後再試一次。',
  missingJarKeep: '已幫您保留，下次帶空罐再來領取。',
  missingJarTopup: '請線上補付差額 NT$30 後再領取。',
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
