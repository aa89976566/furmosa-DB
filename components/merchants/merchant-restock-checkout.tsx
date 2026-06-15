'use client';

import { useMemo, useState } from 'react';
import { CarrierSelect } from '@/components/shared/carrier-select';
import { OrderShippingPaymentFields } from '@/components/shared/order-shipping-payment-fields';
import {
  MerchantField,
  MerchantInfoStrip,
  MerchantNotice,
} from '@/components/merchants/merchant-ui';
import type { MerchantShippingDefaults } from '@/lib/merchant-shipping-defaults';
import { shippingMethodFromCarrier } from '@/lib/orders/parse-restock-form';

export function MerchantRestockCheckout({
  merchantId,
  merchantLabel,
  defaults,
}: {
  merchantId: string;
  merchantLabel: string;
  defaults: MerchantShippingDefaults;
}) {
  const [carrier, setCarrier] = useState(defaults.defaultCarrier);

  const shippingMethod = useMemo(() => shippingMethodFromCarrier(carrier), [carrier]);

  return (
    <div className="space-y-6">
      <MerchantNotice variant="info">
        <span className="font-medium text-navy">{merchantLabel}</span>
        {' '}的收件資料已從店家檔案帶入；本次出貨若要改門市或聯絡人，請在下方調整。
      </MerchantNotice>

      <MerchantInfoStrip
        items={[
          { label: '門市／地址', value: defaults.pickupStore || '—' },
          { label: '聯絡人', value: defaults.pickupName || '—' },
          { label: '電話', value: defaults.pickupPhone || '—' },
        ]}
      />

      <MerchantField
        label="本次物流方式"
        hint="7-11 會帶入上方門市與聯絡人；黑貓／宅配則使用店家檔案中的收件地址。"
      >
        <CarrierSelect
          key={merchantId}
          defaultValue={defaults.defaultCarrier}
          defaultPickupStore={defaults.pickupStore}
          defaultPickupName={defaults.pickupName}
          defaultPickupPhone={defaults.pickupPhone}
          onCarrierChange={setCarrier}
        />
      </MerchantField>

      <div className="border-t pt-5">
        <p className="mb-3 text-sm font-medium text-navy">金額與付款</p>
        <OrderShippingPaymentFields shippingMethod={shippingMethod} />
      </div>
    </div>
  );
}
