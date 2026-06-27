'use client';

import { useMemo, useState } from 'react';
import { OrderDiscountField } from '@/components/shared/order-discount-field';
import { formatCurrency } from '@/lib/format';
import {
  orderTotalFromAmounts,
  resolveOrderShipping,
  shippingMethodLabel,
  SHIPPING_FEE_CVS_711,
  SHIPPING_FEE_HOME_BLACK_CAT,
  type ShippingFeeType,
} from '@/lib/shipping-policy';
import {
  Banknote,
  CheckCircle2,
  Coins,
  CreditCard,
  HandCoins,
  Truck,
} from 'lucide-react';

type ShippingMethod = 'home' | 'convenience' | 'delivery';

type Props = {
  shippingMethod: ShippingMethod;
  cvsBrand?: string | null;
  subtotal?: number;
  showDiscount?: boolean;
  defaultShippingFeeType?: ShippingFeeType;
  defaultPaymentStatus?: 'unpaid' | 'paid' | 'cod';
  defaultDiscount?: number;
};

function FeeTypeCard({
  active,
  icon,
  title,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left transition ${
        active ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
      }`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${
          active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 text-xs font-medium">{title}</div>
    </button>
  );
}

function PayCard({
  active,
  icon,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left transition ${
        active ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
      }`}
    >
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded ${
          active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}
      >
        {icon}
      </div>
      <div>
        <div className="text-xs font-medium">{title}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{desc}</div>
      </div>
    </button>
  );
}

function FieldInline({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

/** 訂單／進貨共用的運費類型與付款狀態選擇 */
export function OrderShippingPaymentFields({
  shippingMethod,
  cvsBrand = '711',
  subtotal = 0,
  showDiscount = false,
  defaultShippingFeeType = 'unpaid',
  defaultPaymentStatus = 'unpaid',
  defaultDiscount = 0,
}: Props) {
  const [shippingFeeType, setShippingFeeType] = useState<ShippingFeeType>(defaultShippingFeeType);
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'paid' | 'cod'>(
    defaultPaymentStatus,
  );
  const [discount, setDiscount] = useState(defaultDiscount);

  const shippingResolved = useMemo(
    () =>
      resolveOrderShipping({
        shippingFeeType,
        shippingMethod,
        cvsBrand,
      }),
    [shippingFeeType, shippingMethod, cvsBrand],
  );

  const total = useMemo(
    () => orderTotalFromAmounts(subtotal, discount, shippingResolved.shippingFee),
    [subtotal, discount, shippingResolved.shippingFee],
  );

  return (
    <div className="space-y-4">
      <input type="hidden" name="shippingFeeType" value={shippingFeeType} />
      <input type="hidden" name="paymentStatus" value={paymentStatus} />
      <input type="hidden" name="shippingMethod" value={shippingMethod} />
      {!showDiscount ? <input type="hidden" name="discount" value={0} /> : null}

      <FieldInline label="運費類型">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <FeeTypeCard
            active={shippingFeeType === 'free'}
            icon={<Truck className="h-4 w-4" />}
            title="包郵"
            onClick={() => setShippingFeeType('free')}
          />
          <FeeTypeCard
            active={shippingFeeType === 'prepaid'}
            icon={<CheckCircle2 className="h-4 w-4" />}
            title="已付費"
            onClick={() => setShippingFeeType('prepaid')}
          />
          <FeeTypeCard
            active={shippingFeeType === 'unpaid'}
            icon={<Coins className="h-4 w-4" />}
            title="不包郵"
            onClick={() => setShippingFeeType('unpaid')}
          />
          <FeeTypeCard
            active={shippingFeeType === 'cod'}
            icon={<HandCoins className="h-4 w-4" />}
            title="運費貨到付"
            onClick={() => setShippingFeeType('cod')}
          />
        </div>
      </FieldInline>

      <FieldInline label="付款狀態">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <PayCard
            active={paymentStatus === 'unpaid'}
            icon={<Banknote className="h-4 w-4" />}
            title="未付款"
            desc="尚未收到貨款"
            onClick={() => setPaymentStatus('unpaid')}
          />
          <PayCard
            active={paymentStatus === 'paid'}
            icon={<CreditCard className="h-4 w-4" />}
            title="已付款"
            desc="貨款已收齊"
            onClick={() => setPaymentStatus('paid')}
          />
          <PayCard
            active={paymentStatus === 'cod'}
            icon={<HandCoins className="h-4 w-4" />}
            title="貨到付款"
            desc="送達時付款"
            onClick={() => setPaymentStatus('cod')}
          />
        </div>
      </FieldInline>

      <div className={`grid gap-3 ${showDiscount ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        {subtotal > 0 ? (
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="text-[11px] text-muted-foreground">小計</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums">{formatCurrency(subtotal)}</div>
          </div>
        ) : null}
        {showDiscount ? (
          <FieldInline label="折扣">
            <OrderDiscountField
              subtotal={subtotal}
              discount={discount}
              onDiscountChange={setDiscount}
            />
          </FieldInline>
        ) : null}
        <FieldInline label="運費試算">
          <div className="space-y-1 rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <p className="text-xs text-muted-foreground">
              {shippingMethodLabel({ shippingMethod, cvsBrand })}
            </p>
            <p className="font-mono tabular-nums">
              應付運費 {formatCurrency(shippingResolved.shippingFee)}
            </p>
            {shippingResolved.companyShippingCost > 0 ? (
              <p className="text-xs text-warning">
                公司運費成本 {formatCurrency(shippingResolved.companyShippingCost)}
              </p>
            ) : null}
          </div>
        </FieldInline>
        <div className="rounded-md border border-primary bg-primary/5 p-3">
          <div className="text-[11px] text-muted-foreground">合計</div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums text-primary">
            {formatCurrency(total)}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        運費依物流方式：7-11 {SHIPPING_FEE_CVS_711} 元、黑貓宅配 {SHIPPING_FEE_HOME_BLACK_CAT} 元、送貨 0 元。
      </p>
    </div>
  );
}
