import type { Prisma } from '@prisma/client';
import { isPreShipStatus } from '@/lib/shipment';
import { restockStatusLabelForMerchant } from '@/lib/restock-request/constants';

export const MERCHANT_RESTOCK_PREPARING_LABEL = '備貨中';
export const MERCHANT_RESTOCK_IN_TRANSIT_LABEL = '配送中';
export const MERCHANT_RESTOCK_DELIVERED_LABEL = '已到貨';
export const MERCHANT_RESTOCK_PROGRESS_UNKNOWN_LABEL = '進度待確認';

export const HOME_WAITING_REQUEST_STATUSES = [
  'submitted',
  'under_review',
  'approved',
] as const;

export const RESTOCK_PROGRESS_SHIPMENT_SELECT = {
  status: true,
  merchantId: true,
} as const;

export type RestockProgressShipment = {
  status: string;
  merchantId: string | null;
};

export type RestockProgressSource = {
  id: string;
  status: string;
  shipment?: RestockProgressShipment | null;
};

/** 只採用該店申請關聯、且出貨單也屬於同一店家的狀態。 */
export function shipmentStatusForMerchant(
  shipment: RestockProgressShipment | null | undefined,
  merchantId: string,
): string | null {
  if (!shipment) return null;
  if (!merchantId || shipment.merchantId !== merchantId) return null;
  return shipment.status;
}

/**
 * POS 補貨進度：未轉單沿用申請文案；已轉單看關聯出貨狀態。
 * 不猜測備貨中或已到貨。
 */
export function merchantRestockProgressLabel(
  requestStatus: string,
  shipmentStatus: string | null | undefined,
): string {
  if (requestStatus !== 'converted_to_shipment') {
    return restockStatusLabelForMerchant(requestStatus);
  }
  if (shipmentStatus == null || shipmentStatus === '') {
    return MERCHANT_RESTOCK_PROGRESS_UNKNOWN_LABEL;
  }
  if (isPreShipStatus(shipmentStatus)) return MERCHANT_RESTOCK_PREPARING_LABEL;
  if (shipmentStatus === 'shipped') return MERCHANT_RESTOCK_IN_TRANSIT_LABEL;
  if (shipmentStatus === 'delivered') return MERCHANT_RESTOCK_DELIVERED_LABEL;
  return MERCHANT_RESTOCK_PROGRESS_UNKNOWN_LABEL;
}

/** 查詢紀錄既有未轉單文案是「已送出」，轉單後改走同一套進度規則。 */
export function merchantRestockQueryFeedStatus(
  requestStatus: string,
  shipmentStatus: string | null | undefined,
): string {
  if ((HOME_WAITING_REQUEST_STATUSES as readonly string[]).includes(requestStatus)) {
    return '已送出';
  }
  return merchantRestockProgressLabel(requestStatus, shipmentStatus);
}

export function isMerchantRestockWaitingToShip(
  requestStatus: string,
  shipmentStatus: string | null | undefined,
): boolean {
  if ((HOME_WAITING_REQUEST_STATUSES as readonly string[]).includes(requestStatus)) {
    return true;
  }
  return (
    requestStatus === 'converted_to_shipment' &&
    typeof shipmentStatus === 'string' &&
    isPreShipStatus(shipmentStatus)
  );
}

export function isMerchantRestockInTransit(
  requestStatus: string,
  shipmentStatus: string | null | undefined,
): boolean {
  return requestStatus === 'converted_to_shipment' && shipmentStatus === 'shipped';
}

export type HomeRestockNotice = {
  waitingToShipCount: number;
  inTransitCount: number;
  firstWaitingRestockId: string | null;
  firstInTransitRestockId: string | null;
};

export function projectHomeRestockNotice(
  rows: RestockProgressSource[],
  merchantId: string,
): HomeRestockNotice {
  const waiting: string[] = [];
  const inTransit: string[] = [];
  for (const row of rows) {
    const shipmentStatus = shipmentStatusForMerchant(row.shipment, merchantId);
    if (isMerchantRestockWaitingToShip(row.status, shipmentStatus)) {
      waiting.push(row.id);
    } else if (isMerchantRestockInTransit(row.status, shipmentStatus)) {
      inTransit.push(row.id);
    }
  }
  return {
    waitingToShipCount: waiting.length,
    inTransitCount: inTransit.length,
    firstWaitingRestockId: waiting[0] ?? null,
    firstInTransitRestockId: inTransit[0] ?? null,
  };
}

export function restockHomeFromSettled(
  result: PromiseSettledResult<RestockProgressSource[]>,
  merchantId: string,
): { kind: 'error' } | { kind: 'ok'; notice: HomeRestockNotice } {
  if (result.status === 'rejected') return { kind: 'error' };
  return { kind: 'ok', notice: projectHomeRestockNotice(result.value, merchantId) };
}

/** 進度列表實際查詢的 select；回傳用 Prisma payload，避免當成無 select 的預設列。 */
export const RESTOCK_PROGRESS_LIST_SELECT = {
  id: true,
  requestType: true,
  status: true,
  createdAt: true,
  expectedArrivalDate: true,
  shipment: { select: RESTOCK_PROGRESS_SHIPMENT_SELECT },
} as const;

export type RestockProgressListArgs = {
  where: { merchantId: string };
  orderBy: { createdAt: 'desc' };
  take: number;
  select: typeof RESTOCK_PROGRESS_LIST_SELECT;
};

export type RestockProgressListRow = Prisma.RestockRequestGetPayload<{
  select: typeof RESTOCK_PROGRESS_LIST_SELECT;
}>;

/** 只要求 findMany 能接受本列表查詢；PrismaClient 與測試 double 都能符合。 */
export type MerchantRestockListDb = {
  restockRequest: {
    findMany: (args: RestockProgressListArgs) => Promise<RestockProgressListRow[]>;
  };
};

export async function listMerchantRestockProgress(
  db: MerchantRestockListDb,
  merchantId: string,
) {
  const rows = await db.restockRequest.findMany({
    where: { merchantId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: RESTOCK_PROGRESS_LIST_SELECT,
  });
  return rows.map((row) => ({
    ...row,
    progressLabel: merchantRestockProgressLabel(
      row.status,
      shipmentStatusForMerchant(row.shipment, merchantId),
    ),
  }));
}
