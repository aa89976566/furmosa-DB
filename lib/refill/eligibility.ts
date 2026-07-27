import type { RefillOrderType } from '@/lib/refill/constants';
import { REFILL_ACTIVE_STATUSES, REFILL_PRICES } from '@/lib/refill/constants';

export type BookingEligibilityInput = {
  status: string;
  startsAt: Date;
  merchantId: string;
  now?: Date;
};

export type ActiveOrderInput = {
  id: string;
  status: string;
  appointmentId: string;
};

export type EligibilityResult =
  | {
      ok: true;
      orderType: RefillOrderType;
      amount: number;
      reason?: undefined;
    }
  | {
      ok: false;
      orderType?: RefillOrderType;
      amount?: number;
      reason: string;
      code: string;
    };

/** 純邏輯：預約是否可綁換罐（未來＋已確認） */
export function isBookableForRefill(input: BookingEligibilityInput): {
  ok: boolean;
  code?: string;
} {
  const now = input.now ?? new Date();
  if (input.status === 'cancelled') {
    return { ok: false, code: 'BOOKING_CANCELLED' };
  }
  if (input.status !== 'confirmed') {
    return { ok: false, code: 'BOOKING_NOT_CONFIRMED' };
  }
  if (input.startsAt.getTime() < now.getTime()) {
    return { ok: false, code: 'BOOKING_EXPIRED' };
  }
  return { ok: true };
}

/** 同預約是否已有未完成換罐單 */
export function findBlockingActiveOrder(
  appointmentId: string,
  activeOrders: ActiveOrderInput[],
): ActiveOrderInput | null {
  return (
    activeOrders.find(
      (o) =>
        o.appointmentId === appointmentId &&
        REFILL_ACTIVE_STATUSES.includes(o.status as (typeof REFILL_ACTIVE_STATUSES)[number]),
    ) ?? null
  );
}

/**
 * 決定首罐／換罐。hasIssuedJar = 會員至少一罐 status=issued 且未鎖定。
 * 前端傳入金額一律忽略；此函式只回傳後端應收金額。
 */
export function resolveOrderTypeAndAmount(input: {
  booking: BookingEligibilityInput;
  hasIssuedJar: boolean;
  activeOrdersForAppointment: ActiveOrderInput[];
  /** 前端竄改金額時仍以後端為準 */
  clientAmount?: number;
}): EligibilityResult {
  const bookingOk = isBookableForRefill(input.booking);
  if (!bookingOk.ok) {
    return {
      ok: false,
      code: bookingOk.code ?? 'NO_BOOKING',
      reason:
        bookingOk.code === 'BOOKING_NOT_CONFIRMED'
          ? '這筆預約尚未確認，確認後才能付款。'
          : '目前找不到可換罐的預約。',
    };
  }

  const blocking = findBlockingActiveOrder(
    // appointment id is not on booking input — caller passes filtered list
    input.activeOrdersForAppointment[0]?.appointmentId ?? '',
    input.activeOrdersForAppointment,
  );
  // Prefer explicit check by caller-supplied list for this appointment
  const anyActive = input.activeOrdersForAppointment.some((o) =>
    REFILL_ACTIVE_STATUSES.includes(o.status as (typeof REFILL_ACTIVE_STATUSES)[number]),
  );
  if (anyActive || blocking) {
    return {
      ok: false,
      code: 'ACTIVE_ORDER_EXISTS',
      reason: '這筆換罐已經付款，不需要再付一次。',
    };
  }

  if (input.hasIssuedJar) {
    return {
      ok: true,
      orderType: 'exchange',
      amount: REFILL_PRICES.exchange,
    };
  }

  return {
    ok: true,
    orderType: 'first',
    amount: REFILL_PRICES.first,
  };
}

/** 即使前端傳錯金額，後端仍固定回傳正確價 */
export function coerceServerAmount(
  orderType: RefillOrderType,
  _clientAmount?: number,
): number {
  return orderType === 'exchange' ? REFILL_PRICES.exchange : REFILL_PRICES.first;
}
