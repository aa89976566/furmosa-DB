import { is711Carrier } from '@/lib/carrier-cvs';
import {
  resolveOrderShipping,
  SHIPPING_CARRIER_DELIVERY,
  SHIPPING_FEE_TYPES,
  type ShippingMethod,
} from '@/lib/shipping-policy';

const VALID_PAYMENT_STATUSES = ['unpaid', 'paid', 'cod'] as const;

export function shippingMethodFromCarrier(carrier: string | null | undefined): ShippingMethod {
  const c = (carrier ?? '').trim();
  if (is711Carrier(c)) return 'convenience';
  if (c === SHIPPING_CARRIER_DELIVERY || c === '送貨') return 'delivery';
  return 'home';
}

export type ParsedRestockShipping = {
  shippingFeeType: string;
  paymentStatus: string;
  shippingMethod: ShippingMethod;
  shippingFee: number;
  companyShippingCost: number;
  discount: number;
  total: number;
  cvsBrand: string | null;
};

export function parseRestockShippingFromForm(
  formData: FormData,
  carrier: string | null,
): ParsedRestockShipping {
  const shippingFeeTypeRaw = String(formData.get('shippingFeeType') ?? 'unpaid');
  const shippingFeeType = (SHIPPING_FEE_TYPES as readonly string[]).includes(shippingFeeTypeRaw)
    ? shippingFeeTypeRaw
    : 'unpaid';

  const paymentStatusRaw = String(formData.get('paymentStatus') ?? 'unpaid');
  const paymentStatus = (VALID_PAYMENT_STATUSES as readonly string[]).includes(paymentStatusRaw)
    ? paymentStatusRaw
    : 'unpaid';

  const methodRaw = String(formData.get('shippingMethod') ?? '').trim();
  const shippingMethod: ShippingMethod =
    methodRaw === 'convenience' || methodRaw === 'delivery' || methodRaw === 'home'
      ? methodRaw
      : shippingMethodFromCarrier(carrier);

  const discount = Math.max(0, Number(formData.get('discount')) || 0);
  const cvsBrand = shippingMethod === 'convenience' ? '711' : null;

  const { shippingFee, companyShippingCost } = resolveOrderShipping({
    shippingFeeType,
    shippingMethod,
    cvsBrand,
  });

  return {
    shippingFeeType,
    paymentStatus,
    shippingMethod,
    shippingFee,
    companyShippingCost,
    discount,
    total: Math.max(0, shippingFee - discount),
    cvsBrand,
  };
}
