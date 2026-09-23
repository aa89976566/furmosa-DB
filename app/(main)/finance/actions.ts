'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { CASH_WEEK_COUNT, isFinanceChannel } from '@/lib/finance/channels';
import {
  productionFinanceDeps,
  updateCashPlan,
  updateChannelCost,
  updateMarginThresholds,
  updateProductCosts,
} from '@/lib/finance/mutations';

function finish(
  pathname: string,
  params: URLSearchParams,
  result: { ok: true } | { ok: false; message: string },
): never {
  if (result.ok) {
    revalidatePath('/finance');
    params.set('saved', '1');
  } else {
    params.set('error', result.message);
  }
  const query = params.toString();
  redirect(query ? `${pathname}?${query}` : pathname);
}

export async function saveProductCosts(formData: FormData) {
  const channel = String(formData.get('channel') ?? 'website');
  const safeChannel = isFinanceChannel(channel) ? channel : 'website';
  const deps = await productionFinanceDeps();
  const result = await updateProductCosts(
    {
      productId: String(formData.get('productId') ?? ''),
      foodCost: formData.get('foodCost'),
      packagingCost: formData.get('packagingCost'),
    },
    deps,
  );
  finish('/finance/products', new URLSearchParams({ channel: safeChannel }), result);
}

export async function saveThresholds(formData: FormData) {
  const channel = String(formData.get('channel') ?? 'website');
  const safeChannel = isFinanceChannel(channel) ? channel : 'website';
  const deps = await productionFinanceDeps();
  const result = await updateMarginThresholds(
    { green: formData.get('green'), yellow: formData.get('yellow') },
    deps,
  );
  finish('/finance/products', new URLSearchParams({ channel: safeChannel }), result);
}

export async function saveChannelCost(formData: FormData) {
  const sku = String(formData.get('sku') ?? '');
  const deps = await productionFinanceDeps();
  const result = await updateChannelCost(
    {
      productId: String(formData.get('productId') ?? ''),
      channel: formData.get('channel'),
      otherDirectCost: formData.get('otherDirectCost'),
      cleaning: formData.get('cleaning'),
      transport: formData.get('transport'),
      groupLeaderShare: formData.get('groupLeaderShare'),
      centerShare: formData.get('centerShare'),
    },
    deps,
  );
  const params = new URLSearchParams();
  if (sku) params.set('sku', sku);
  finish('/finance/channels', params, result);
}

export async function saveCashPlan(formData: FormData) {
  const deps = await productionFinanceDeps();
  const weeks = Array.from({ length: CASH_WEEK_COUNT }, (_, index) => ({
    inflow: formData.get(`inflow-${index}`),
    supplierPayment: formData.get(`supplier-${index}`),
    packaging: formData.get(`packaging-${index}`),
    payroll: formData.get(`payroll-${index}`),
    ads: formData.get(`ads-${index}`),
    logistics: formData.get(`logistics-${index}`),
    sampling: formData.get(`sampling-${index}`),
  }));
  const result = await updateCashPlan(
    {
      openingBalance: formData.get('openingBalance'),
      minimumCash: formData.get('minimumCash'),
      weeks,
    },
    deps,
  );
  finish('/finance/cash-flow', new URLSearchParams(), result);
}
