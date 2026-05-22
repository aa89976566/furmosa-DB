/** 純函式，可供 Client Component 使用（勿 import prisma） */

export type CustomerShippingSource = {
  name: string;
  phone: string | null;
  address: string | null;
  preferredShippingMethod: string | null;
  preferredCvsBrand: string | null;
  preferredCvsStoreName: string | null;
};

export function customerShippingDefaults(customer: CustomerShippingSource) {
  const recipientName = customer.name.trim();
  const recipientPhone = customer.phone?.trim() || '';

  let shippingAddress = customer.address?.trim() || '';
  if (
    customer.preferredShippingMethod === 'convenience' &&
    customer.preferredCvsStoreName?.trim()
  ) {
    const brandLabel =
      customer.preferredCvsBrand === '711'
        ? '7-11'
        : customer.preferredCvsBrand === 'familymart'
          ? '全家'
          : customer.preferredCvsBrand === 'hilife'
            ? '萊爾富'
            : '超商';
    shippingAddress = `${brandLabel} · ${customer.preferredCvsStoreName.trim()}`;
  }

  return { recipientName, recipientPhone, shippingAddress };
}
