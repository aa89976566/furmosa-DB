import { SHIPMENT_KIND_KEYS } from '@/lib/order-hub-kinds';
import { SHIPMENT_STATUSES } from '@/lib/shipment';

/** Diagnostic timers for the shipment queue. Logging stays Preview-only. */
export const SHIPMENT_QUEUE_PERF_EVENT = 'hq.shipments.queue.perf';

const STATUS_ALLOWLIST = new Set<string>(SHIPMENT_STATUSES);
const TYPE_ALLOWLIST = new Set<string>(SHIPMENT_KIND_KEYS);

/** Bound platform request IDs so oversized or odd values never reach logs. */
const VERCEL_REQUEST_ID_MAX_LEN = 128;
const VERCEL_REQUEST_ID_PATTERN = /^[A-Za-z0-9:._-]+$/;

const FETCH_MODE_ALLOWLIST = new Set([
  'navigate',
  'cors',
  'no-cors',
  'same-origin',
  'websocket',
]);
const FETCH_DEST_ALLOWLIST = new Set([
  'document',
  'empty',
  'script',
  'style',
  'image',
  'iframe',
  'worker',
  'serviceworker',
  'font',
  'manifest',
]);
const FETCH_PURPOSE_ALLOWLIST = new Set(['prefetch']);

const SEGMENT_CODE = {
  findMany: 'FIND_MANY',
  counts: 'COUNTS',
  jiba: 'JIBA',
  transform: 'TRANSFORM',
} as const;

type AsyncSegment = 'findMany' | 'counts' | 'jiba';
type Segment = AsyncSegment | 'transform';
type SegmentCode = (typeof SEGMENT_CODE)[Segment];

export type ShipmentQueuePerfCounts = {
  shipmentCount: number;
  itemCount: number;
  priceTierCount: number;
  inventoryBalanceCount: number;
  orderIdCount: number;
};

export type ShipmentQueuePerfLogInput = {
  status: string;
  type: string;
  counts: ShipmentQueuePerfCounts;
};

export type ShipmentQueuePerfRequestContext = {
  requestId: string | null;
  fetchMode: string;
  fetchDest: string;
  fetchPurpose: string;
};

export type HeaderReader = {
  get(name: string): string | null;
};

type ShipmentQueuePerfLogLine = {
  event: typeof SHIPMENT_QUEUE_PERF_EVENT;
  status: string;
  type: string;
  success: boolean;
  requestId: string | null;
  fetchMode: string;
  fetchDest: string;
  fetchPurpose: string;
  findManyMs: number;
  countsMs: number;
  jibaMs: number;
  transformMs: number;
  totalMs: number;
  shipmentCount: number;
  itemCount: number;
  priceTierCount: number;
  inventoryBalanceCount: number;
  orderIdCount: number;
  errorCategory?: 'segment_rejected' | 'unattributed';
  errorCode?: SegmentCode | 'UNATTRIBUTED';
};

export type ShipmentQueuePerfShipmentSample = {
  items?: ReadonlyArray<{
    product?: {
      priceTiers?: readonly unknown[] | null;
      inventoryBalances?: readonly unknown[] | null;
      inventorySourceProduct?: {
        inventoryBalances?: readonly unknown[] | null;
      } | null;
    } | null;
  }> | null;
};

export type ShipmentQueuePerf = {
  readonly enabled: boolean;
  measure<T>(segment: AsyncSegment, run: () => Promise<T>): Promise<T>;
  measureSync<T>(run: () => T): T;
  succeed(input: ShipmentQueuePerfLogInput): void;
  fail(input: ShipmentQueuePerfLogInput): void;
};

const UNKNOWN_FETCH = 'unknown';
const OTHER_FETCH = 'other';

const EMPTY_REQUEST_CONTEXT: ShipmentQueuePerfRequestContext = {
  requestId: null,
  fetchMode: UNKNOWN_FETCH,
  fetchDest: UNKNOWN_FETCH,
  fetchPurpose: UNKNOWN_FETCH,
};

export function isShipmentQueuePerfEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL_ENV === 'preview' && env.SHIPMENTS_PERF_LOG === '1';
}

/** Keep only a bounded, charset-safe copy of the platform request ID. */
export function sanitizeVercelRequestId(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  if (raw.length === 0 || raw.length > VERCEL_REQUEST_ID_MAX_LEN) return null;
  if (raw.trim() !== raw) return null;
  if (!VERCEL_REQUEST_ID_PATTERN.test(raw)) return null;
  return raw;
}

function classifyFetchValue(
  raw: string | null | undefined,
  allowlist: Set<string>,
): string {
  if (typeof raw !== 'string') return UNKNOWN_FETCH;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return UNKNOWN_FETCH;
  if (allowlist.has(normalized)) return normalized;
  return OTHER_FETCH;
}

/** Map request headers into allowlisted classification fields. Call only when enabled. */
export function readShipmentQueuePerfRequestContext(
  headerStore: HeaderReader,
): ShipmentQueuePerfRequestContext {
  return {
    requestId: sanitizeVercelRequestId(headerStore.get('x-vercel-id')),
    fetchMode: classifyFetchValue(headerStore.get('sec-fetch-mode'), FETCH_MODE_ALLOWLIST),
    fetchDest: classifyFetchValue(headerStore.get('sec-fetch-dest'), FETCH_DEST_ALLOWLIST),
    fetchPurpose: classifyFetchValue(headerStore.get('sec-purpose'), FETCH_PURPOSE_ALLOWLIST),
  };
}

export function emptyShipmentQueuePerfCounts(): ShipmentQueuePerfCounts {
  return {
    shipmentCount: 0,
    itemCount: 0,
    priceTierCount: 0,
    inventoryBalanceCount: 0,
    orderIdCount: 0,
  };
}

function arrayLength(value: readonly unknown[] | null | undefined): number {
  return Array.isArray(value) ? value.length : 0;
}

/** Counts collection sizes only. Callers must not pass this function objects they expect to be copied. */
export function countShipmentQueueSamples(
  shipments: readonly ShipmentQueuePerfShipmentSample[],
  orderIds: readonly unknown[],
): ShipmentQueuePerfCounts {
  let itemCount = 0;
  let priceTierCount = 0;
  let inventoryBalanceCount = 0;
  for (const shipment of shipments) {
    const items = shipment.items ?? [];
    itemCount += items.length;
    for (const item of items) {
      const product = item.product;
      if (!product) continue;
      priceTierCount += arrayLength(product.priceTiers);
      inventoryBalanceCount += arrayLength(product.inventoryBalances);
      inventoryBalanceCount += arrayLength(product.inventorySourceProduct?.inventoryBalances);
    }
  }
  return {
    shipmentCount: asCount(shipments.length),
    itemCount: asCount(itemCount),
    priceTierCount: asCount(priceTierCount),
    inventoryBalanceCount: asCount(inventoryBalanceCount),
    orderIdCount: asCount(orderIds.length),
  };
}

export function createShipmentQueuePerf(options?: {
  enabled?: boolean;
  now?: () => number;
  requestContext?: ShipmentQueuePerfRequestContext;
}): ShipmentQueuePerf {
  const enabled = options?.enabled ?? isShipmentQueuePerfEnabled();
  const requestContext = options?.requestContext ?? EMPTY_REQUEST_CONTEXT;
  const now = options?.now ?? (() => performance.now());
  const origin = now();
  const startedAt = new Map<Segment, number>();
  const completedMs = new Map<Segment, number>();
  let failedSegment: Segment | null = null;
  let logged = false;

  function markStart(segment: Segment) {
    startedAt.set(segment, now());
  }

  function markDone(segment: Segment) {
    const start = startedAt.get(segment) ?? now();
    completedMs.set(segment, nonNegativeInt(now() - start));
  }

  function noteFailure(segment: Segment) {
    if (failedSegment == null) failedSegment = segment;
  }

  function readMs(segment: Segment): number {
    // 0 means the segment had not finished. Do not publish a partial elapsed time
    // as if that segment had completed.
    return completedMs.get(segment) ?? 0;
  }

  function emit(success: boolean, input: ShipmentQueuePerfLogInput) {
    if (!enabled || logged) return;
    logged = true;
    const line: ShipmentQueuePerfLogLine = {
      event: SHIPMENT_QUEUE_PERF_EVENT,
      status: sanitizeStatus(input.status),
      type: sanitizeType(input.type),
      success,
      requestId: requestContext.requestId,
      fetchMode: requestContext.fetchMode,
      fetchDest: requestContext.fetchDest,
      fetchPurpose: requestContext.fetchPurpose,
      findManyMs: readMs('findMany'),
      countsMs: readMs('counts'),
      jibaMs: readMs('jiba'),
      transformMs: readMs('transform'),
      totalMs: nonNegativeInt(now() - origin),
      shipmentCount: asCount(input.counts.shipmentCount),
      itemCount: asCount(input.counts.itemCount),
      priceTierCount: asCount(input.counts.priceTierCount),
      inventoryBalanceCount: asCount(input.counts.inventoryBalanceCount),
      orderIdCount: asCount(input.counts.orderIdCount),
    };
    if (!success) {
      if (failedSegment) {
        line.errorCategory = 'segment_rejected';
        line.errorCode = SEGMENT_CODE[failedSegment];
      } else {
        line.errorCategory = 'unattributed';
        line.errorCode = 'UNATTRIBUTED';
      }
    }
    try {
      console.info(line);
    } catch {
      // A diagnostic log must not replace the queue result or the original error.
    }
  }

  return {
    enabled,
    measure<T>(segment: AsyncSegment, run: () => Promise<T>): Promise<T> {
      if (!enabled) return run();
      markStart(segment);
      let pending: Promise<T>;
      try {
        pending = run();
      } catch (error) {
        markDone(segment);
        noteFailure(segment);
        throw error;
      }
      return pending.then(
        (value) => {
          markDone(segment);
          return value;
        },
        (error: unknown) => {
          markDone(segment);
          noteFailure(segment);
          throw error;
        },
      );
    },
    measureSync<T>(run: () => T): T {
      if (!enabled) return run();
      markStart('transform');
      try {
        const value = run();
        markDone('transform');
        return value;
      } catch (error) {
        markDone('transform');
        noteFailure('transform');
        throw error;
      }
    },
    succeed(input) {
      emit(true, input);
    },
    fail(input) {
      emit(false, input);
    },
  };
}

function sanitizeStatus(status: string): string {
  return STATUS_ALLOWLIST.has(status) ? status : '';
}

function sanitizeType(type: string): string {
  return TYPE_ALLOWLIST.has(type) ? type : '';
}

function nonNegativeInt(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value);
}

function asCount(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.trunc(value);
}
