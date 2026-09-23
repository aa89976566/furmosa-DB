import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import React from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { Suspense } from 'react';
import { QueueRowBoundary } from '../../components/shipments/queue-row-boundary';
import { profileDefaults } from '../merchant-shipping-defaults';
import { assembleShipmentQueueRow, type QueueShipmentSource } from '../shipment-queue-rows';

const fee = { fulfillmentFeeLabel: null, paymentReviewHold: false };

function shipment(overrides: Partial<QueueShipmentSource> = {}): QueueShipmentSource {
  return {
    id: 'shp-1',
    shipmentNumber: 'SHP-1',
    type: 'customer_order',
    status: 'pending',
    createdAt: new Date('2026-09-22T00:00:00.000Z'),
    orderId: 'ord-1',
    merchantId: null,
    customerId: 'cus-1',
    recipientName: '高稚媛',
    items: [{ productId: 'prd-1', productName: '雞肉丁', quantity: 2, weightGrams: 30, productFound: true }],
    order: {
      id: 'ord-1',
      orderNumber: 'ORD-1',
      status: 'confirmed',
      paymentStatus: 'paid',
      shippingMethod: 'home',
    },
    customer: { id: 'cus-1', name: '高稚媛' },
    ...overrides,
  };
}

test('缺少訂單、商品與方案時仍保留出貨單，並標成未對應', () => {
  const rows = [
    assembleShipmentQueueRow(
      shipment({
        orderId: 'missing-order',
        order: null,
        customerId: 'missing-customer',
        customer: null,
        items: [{ productId: 'gone', productName: '舊品名', quantity: 1, weightGrams: 50, productFound: false }],
      }),
      fee,
      [],
    ),
    assembleShipmentQueueRow(
      shipment({
        id: 'shp-sub',
        shipmentNumber: 'SHP-SUB',
        type: 'subscription',
        orderId: null,
        order: null,
        customerId: null,
        customer: null,
        subscriptionShipmentId: 'sub-ship-1',
        subscriptionShipment: {
          shipmentNo: 'SUB-SHIP-1',
          scheduledDate: 'not-a-date',
          subscription: { subscriptionNo: 'SUB-1', plan: null },
        },
        items: [],
      }),
      fee,
      [],
    ),
  ];

  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.id, 'shp-1');
  assert.equal(rows[0]?.shipmentNumber, 'SHP-1');
  assert.equal(rows[0]?.order, null);
  assert.equal(rows[0]?.items[0]?.productName, '舊品名');
  assert.ok(rows[0]?.gaps?.includes('訂單未對應'));
  assert.ok(rows[0]?.gaps?.includes('顧客未對應'));
  assert.ok(rows[0]?.gaps?.includes('商品未對應'));
  assert.equal(rows[1]?.id, 'shp-sub');
  assert.equal(rows[1]?.subscriptionShipment?.scheduledDate, null);
  assert.equal(rows[1]?.subscriptionShipment?.subscription?.plan, null);
  assert.ok(rows[1]?.gaps?.includes('方案未對應'));
});

test('店家名稱是空值時，物流預設不丟出例外', () => {
  const defaults = profileDefaults({
    name: null as unknown as string,
    contactName: null,
    phone: null,
    address: null,
    preferredCarrier: null,
    pickupStoreName: null,
  });
  assert.equal(defaults.pickupName, '店家未對應');
});

test('出貨清單主查詢不再把關聯一起 join', () => {
  const source = readFileSync('app/(main)/shipments/shipments-queue-body.tsx', 'utf8');
  assert.match(source, /select: shipmentSelect/);
  assert.doesNotMatch(source, /include: shipmentInclude/);
  assert.match(source, /prisma\.order\.findMany/);
  assert.match(source, /prisma\.merchant\.findMany/);
  assert.match(source, /prisma\.customer\.findMany/);
  assert.match(source, /prisma\.subscriptionShipment\.findMany/);
  assert.match(source, /assembleShipmentQueueRow/);
});

test('單筆渲染失敗不會讓其他出貨列從 SSR 消失', async () => {
  function Boom(): React.ReactNode {
    throw new Error('bad shipment row');
  }
  function Good() {
    return React.createElement('span', null, 'SHP-GOOD');
  }
  function Row({ children }: { children: React.ReactNode }) {
    return React.createElement(
      Suspense,
      { fallback: React.createElement('p', null, '資料缺漏') },
      React.createElement(QueueRowBoundary, null, children),
    );
  }

  const html = await new Promise<string>((resolve, reject) => {
    const stream = new PassThrough();
    let body = '';
    const timer = setTimeout(() => reject(new Error(`timeout:${body.slice(0, 400)}`)), 2000);
    stream.on('data', (chunk) => {
      body += chunk.toString();
    });
    stream.on('end', () => {
      clearTimeout(timer);
      resolve(body);
    });
    const { pipe } = renderToPipeableStream(
      React.createElement(
        'div',
        null,
        React.createElement(Row, null, React.createElement(Boom)),
        React.createElement(Row, null, React.createElement(Good)),
      ),
      {
        onAllReady() {
          pipe(stream);
        },
        onShellError(error) {
          clearTimeout(timer);
          reject(error);
        },
        onError() {},
      },
    );
  });

  assert.match(html, /資料缺漏/);
  assert.match(html, /SHP-GOOD/);
  const table = readFileSync('components/shipments/shipment-queue-table.tsx', 'utf8');
  assert.match(table, /<Suspense fallback=\{rowFallback\(as\)\}>/);
  assert.match(table, /<QueueRowBoundary/);
});
