import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Exercise the existing shared desktop/mobile label resolver without mounting
// status controls or importing server actions.
const source = readFileSync('components/shipments/shipment-queue-table.tsx', 'utf8');
const match = source.match(/function rowLabel\(s: ShipmentQueueRow\) \{([\s\S]*?)\n\}/);
assert.ok(match, 'shared shipment row label resolver exists');
const rowLabel = new Function('s', match[1]) as (shipment: Record<string, unknown>) => string;

const cases = [
  [
    "個人收件人優先",
    {
      "type": "customer_order",
      "status": "pending",
      "recipientName": "簡玉珊",
      "customer": {
        "name": "下單人"
      },
      "order": {
        "orderNumber": "ORD-202609-015"
      }
    },
    "簡玉珊"
  ],
  [
    "店家名稱優先",
    {
      "type": "merchant_restock",
      "status": "pending",
      "merchant": {
        "name": "曼利莎寵物美容"
      },
      "recipientName": "黃昊倫"
    },
    "曼利莎寵物美容"
  ],
  [
    "舊店家單",
    {
      "type": "customer_order",
      "status": "pending",
      "merchant": {
        "name": "洗室"
      },
      "recipientName": "張旖甯"
    },
    "洗室"
  ],
  [
    "無收件人使用客戶姓名",
    {
      "type": "customer_order",
      "status": "pending",
      "recipientName": "  ",
      "customer": {
        "name": " 客戶甲 "
      },
      "order": {
        "orderNumber": "ORD-001"
      }
    },
    "客戶甲"
  ],
  [
    "空店名不遮住收件人",
    {
      "type": "customer_order",
      "status": "pending",
      "merchant": {
        "name": " "
      },
      "recipientName": " 收件甲 "
    },
    "收件甲"
  ],
  [
    "缺姓名保留訂單號",
    {
      "type": "customer_order",
      "status": "pending",
      "order": {
        "orderNumber": "ORD-001"
      }
    },
    "ORD-001"
  ],
  [
    "訂閱區保留原訂閱單號",
    {
      "type": "subscription",
      "status": "pending",
      "recipientName": "訂閱收件人",
      "subscriptionShipment": {
        "subscription": {
          "subscriptionNo": "SUB-1"
        }
      }
    },
    "SUB-1"
  ],
  [
    "舊訂閱無姓名",
    {
      "type": "subscription",
      "status": "pending",
      "subscriptionShipment": {
        "subscription": {
          "subscriptionNo": "SUB-1"
        }
      }
    },
    "SUB-1"
  ],
  [
    "孤立出貨單",
    {
      "type": "customer_order",
      "status": "pending",
      "shipmentNumber": "SHP-001"
    },
    "SHP-001"
  ],
  [
    "packed 個人單",
    {
      "type": "customer_order",
      "status": "packed",
      "recipientName": "收件人",
      "order": {
        "orderNumber": "ORD-001"
      }
    },
    "收件人"
  ],
  [
    "shipped 個人單",
    {
      "type": "customer_order",
      "status": "shipped",
      "recipientName": "收件人",
      "order": {
        "orderNumber": "ORD-001"
      }
    },
    "ORD-001"
  ],
  [
    "delivered 個人單",
    {
      "type": "customer_order",
      "status": "delivered",
      "recipientName": "收件人",
      "order": {
        "orderNumber": "ORD-001"
      }
    },
    "ORD-001"
  ],
  [
    "在途店家仍顯示店名",
    {
      "type": "merchant_restock",
      "status": "shipped",
      "merchant": {
        "name": "店家"
      },
      "recipientName": "聯絡人"
    },
    "店家"
  ]
] as const;

for (const [name, shipment, expected] of cases) {
  test(name, () => {
    assert.equal(rowLabel(shipment), expected);
  });
}
