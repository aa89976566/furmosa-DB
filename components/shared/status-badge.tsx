import { Badge } from '@/components/ui/badge';
import {
  orderStatusLabel,
  orderSourceLabel,
  paymentStatusLabel,
  fulfillmentStatusLabel,
  inventoryTxnTypeLabel,
  merchantStockTxnTypeLabel,
  settlementStatusLabel,
  taskStatusLabel,
  taskPriorityLabel,
  subscriptionStatusLabel,
  subscriptionShipmentStatusLabel,
  subscriptionBillingCycleLabel,
} from '@/lib/labels';

type Variant = 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive' | 'muted' | 'outline';

const orderStatusVariant: Record<string, Variant> = {
  draft: 'muted',
  pending_review: 'warning',
  confirmed: 'info',
  packed: 'warning',
  shipped: 'info',
  delivered: 'success',
  completed: 'success',
  cancelled: 'destructive',
};

const paymentStatusVariant: Record<string, Variant> = {
  unpaid: 'warning',
  partial: 'warning',
  paid: 'success',
  cod: 'warning',
  refunded: 'destructive',
};

const fulfillmentStatusVariant: Record<string, Variant> = {
  pending: 'warning',
  packed: 'warning',
  shipped: 'info',
  delivered: 'success',
  returned: 'destructive',
};

const settlementStatusVariant: Record<string, Variant> = {
  draft: 'muted',
  reviewing: 'warning',
  approved: 'info',
  paid: 'success',
};

const taskStatusVariant: Record<string, Variant> = {
  todo: 'muted',
  in_progress: 'info',
  done: 'success',
  blocked: 'destructive',
};

const taskPriorityVariant: Record<string, Variant> = {
  low: 'muted',
  medium: 'secondary',
  high: 'warning',
  urgent: 'destructive',
};

const sourceVariant: Record<string, Variant> = {
  website: 'info',
  line: 'success',
  consignment: 'warning',
  wholesale: 'info',
  subscription: 'default',
  manual: 'secondary',
  restock: 'warning',
  jar_exchange: 'success',
};

const subscriptionStatusVariant: Record<string, Variant> = {
  active: 'success',
  paused: 'warning',
  cancelled: 'destructive',
  expired: 'muted',
};

const subscriptionShipmentVariant: Record<string, Variant> = {
  pending: 'warning',
  packed: 'warning',
  shipped: 'info',
  delivered: 'success',
  skipped: 'muted',
};

const subscriptionCycleVariant: Record<string, Variant> = {
  monthly: 'secondary',
  halfyear: 'info',
};

const inventoryTxnVariant: Record<string, Variant> = {
  purchase_in: 'success',
  sales_out: 'info',
  transfer: 'secondary',
  adjustment: 'warning',
  stocktake: 'muted',
  return_in: 'success',
  return_out: 'destructive',
};

const merchantStockTxnVariant: Record<string, Variant> = {
  restock: 'success',
  sale: 'info',
  adjust: 'warning',
  return: 'secondary',
};

type StatusKind =
  | 'order'
  | 'orderSource'
  | 'payment'
  | 'fulfillment'
  | 'settlement'
  | 'task'
  | 'taskPriority'
  | 'inventory'
  | 'merchantStock'
  | 'subscription'
  | 'subscriptionShipment'
  | 'subscriptionCycle';

const variantMap: Record<StatusKind, Record<string, Variant>> = {
  order: orderStatusVariant,
  orderSource: sourceVariant,
  payment: paymentStatusVariant,
  fulfillment: fulfillmentStatusVariant,
  settlement: settlementStatusVariant,
  task: taskStatusVariant,
  taskPriority: taskPriorityVariant,
  inventory: inventoryTxnVariant,
  merchantStock: merchantStockTxnVariant,
  subscription: subscriptionStatusVariant,
  subscriptionShipment: subscriptionShipmentVariant,
  subscriptionCycle: subscriptionCycleVariant,
};

const labelMap: Record<StatusKind, Record<string, string>> = {
  order: orderStatusLabel,
  orderSource: orderSourceLabel,
  payment: paymentStatusLabel,
  fulfillment: fulfillmentStatusLabel,
  settlement: settlementStatusLabel,
  task: taskStatusLabel,
  taskPriority: taskPriorityLabel,
  inventory: inventoryTxnTypeLabel,
  merchantStock: merchantStockTxnTypeLabel,
  subscription: subscriptionStatusLabel,
  subscriptionShipment: subscriptionShipmentStatusLabel,
  subscriptionCycle: subscriptionBillingCycleLabel,
};

export function StatusBadge({ kind, value }: { kind: StatusKind; value: string }) {
  const variant = variantMap[kind][value] ?? 'secondary';
  const label = labelMap[kind][value] ?? value;
  return <Badge variant={variant}>{label}</Badge>;
}
