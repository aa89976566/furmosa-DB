import { CARRIER_711, format711RecipientAddress } from '@/lib/carrier-cvs';
import { assertHomeOrDeliveryRecipient, SHIPPING_CARRIER_DELIVERY } from '@/lib/shipping-policy';

type MerchantShipping = {
  preferredCarrier?: string | null;
  contactName?: string | null;
  phone?: string | null;
  address?: string | null;
  pickupStoreName?: string | null;
};

/** Use the merchant's saved recipient fields; never infer a carrier or address. */
export function resolveRestockShipping(merchant: MerchantShipping) {
  const carrier = merchant.preferredCarrier?.trim();
  if (!carrier || ![CARRIER_711, '黑貓', SHIPPING_CARRIER_DELIVERY].includes(carrier)) {
    throw new Error('請先至店家資料選擇物流方式');
  }
  if (carrier === CARRIER_711 && !merchant.pickupStoreName?.trim()) {
    throw new Error('請先至店家資料填寫 7-11 取件門市');
  }
  const recipient = {
    recipientName: merchant.contactName?.trim() ?? '',
    recipientPhone: merchant.phone?.trim() ?? '',
    recipientAddress: carrier === CARRIER_711
      ? format711RecipientAddress(merchant.pickupStoreName!)
      : merchant.address?.trim() ?? '',
  };
  assertHomeOrDeliveryRecipient(recipient);
  return { carrier, ...recipient };
}
