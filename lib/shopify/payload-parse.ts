import { ShopifyWebhookClientError } from '@/lib/shopify/webhook-errors';
import {
  shopifyExternalOrderId,
  type ShopifyAttribute,
  type ShopifyFulfillmentPayload,
  type ShopifyLineItem,
  type ShopifyPaidOrder,
  type ShopifyRefundPayload,
} from '@/lib/shopify/order-mapping';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null | undefined {
  if (value == null) return value;
  return typeof value === 'string' ? value : undefined;
}

function optionalNumber(value: unknown): number | null | undefined {
  if (value == null) return value;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readId(value: unknown): number | string | null {
  return shopifyExternalOrderId(value);
}

function readAttributes(value: unknown): ShopifyAttribute[] | null | undefined {
  if (value == null) return value;
  if (!Array.isArray(value)) return undefined;
  return value.filter(isPlainRecord).map((row) => ({
    name: optionalString(row.name),
    value: optionalString(row.value),
  }));
}

function readLineItems(value: unknown): ShopifyLineItem[] | null | undefined {
  if (value == null) return value;
  if (!Array.isArray(value)) return undefined;
  return value.filter(isPlainRecord).map((row) => ({
    title: optionalString(row.title),
    variant_title: optionalString(row.variant_title),
    sku: optionalString(row.sku),
    quantity: optionalNumber(row.quantity),
    price: optionalString(row.price),
    grams: optionalNumber(row.grams),
  }));
}

function readShippingAddress(value: unknown): ShopifyPaidOrder['shipping_address'] {
  if (value == null) return value;
  if (!isPlainRecord(value)) return undefined;
  return {
    name: optionalString(value.name),
    first_name: optionalString(value.first_name),
    last_name: optionalString(value.last_name),
    phone: optionalString(value.phone),
    company: optionalString(value.company),
    address1: optionalString(value.address1),
    address2: optionalString(value.address2),
    city: optionalString(value.city),
    province: optionalString(value.province),
    zip: optionalString(value.zip),
    country: optionalString(value.country),
  };
}

function readCustomer(value: unknown): ShopifyPaidOrder['customer'] {
  if (value == null) return value;
  if (!isPlainRecord(value)) return undefined;
  return {
    first_name: optionalString(value.first_name),
    last_name: optionalString(value.last_name),
    email: optionalString(value.email),
    phone: optionalString(value.phone),
  };
}

function readShippingLines(value: unknown): ShopifyPaidOrder['shipping_lines'] {
  if (value == null) return value;
  if (!Array.isArray(value)) return undefined;
  return value.filter(isPlainRecord).map((row) => ({ title: optionalString(row.title) }));
}

function readShippingPriceSet(value: unknown): ShopifyPaidOrder['total_shipping_price_set'] {
  if (value == null) return value;
  if (!isPlainRecord(value)) return undefined;
  const shopMoney = value.shop_money;
  if (shopMoney == null) return { shop_money: shopMoney };
  if (!isPlainRecord(shopMoney)) return { shop_money: undefined };
  return { shop_money: { amount: optionalString(shopMoney.amount) } };
}

export function parseShopifyOrderPayload(payload: Record<string, unknown>): ShopifyPaidOrder {
  const id = readId(payload.id);
  if (!id) throw new ShopifyWebhookClientError('缺少 Shopify order id');
  return {
    id,
    name: optionalString(payload.name),
    order_number: optionalNumber(payload.order_number),
    email: optionalString(payload.email),
    phone: optionalString(payload.phone),
    financial_status: optionalString(payload.financial_status),
    processed_at: optionalString(payload.processed_at),
    created_at: optionalString(payload.created_at),
    updated_at: optionalString(payload.updated_at),
    cancelled_at: optionalString(payload.cancelled_at),
    subtotal_price: optionalString(payload.subtotal_price),
    total_discounts: optionalString(payload.total_discounts),
    total_price: optionalString(payload.total_price),
    total_shipping_price_set: readShippingPriceSet(payload.total_shipping_price_set),
    note_attributes: readAttributes(payload.note_attributes),
    customer: readCustomer(payload.customer),
    shipping_address: readShippingAddress(payload.shipping_address),
    shipping_lines: readShippingLines(payload.shipping_lines),
    line_items: readLineItems(payload.line_items),
  };
}

export function parseShopifyFulfillmentPayload(payload: Record<string, unknown>): ShopifyFulfillmentPayload {
  const id = readId(payload.id);
  const orderId = readId(payload.order_id);
  if (!id || !orderId) throw new ShopifyWebhookClientError('缺少 Shopify fulfillment 或 order id');
  return {
    id,
    order_id: orderId,
    status: optionalString(payload.status),
    shipment_status: optionalString(payload.shipment_status),
    updated_at: optionalString(payload.updated_at),
    created_at: optionalString(payload.created_at),
  };
}

export function parseShopifyRefundPayload(payload: Record<string, unknown>): ShopifyRefundPayload {
  const id = readId(payload.id);
  const orderId = readId(payload.order_id);
  if (!id || !orderId) throw new ShopifyWebhookClientError('缺少 Shopify refund 或 order id');
  return {
    id,
    order_id: orderId,
    created_at: optionalString(payload.created_at),
    processed_at: optionalString(payload.processed_at),
  };
}
