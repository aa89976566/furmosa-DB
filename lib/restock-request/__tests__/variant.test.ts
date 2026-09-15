import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { resolveRestockVariant } from '../variant';
import { resolveTierIdFromWeightGrams } from '@/lib/merchant-stock-key';
import { prisma } from '@/lib/prisma';
import { submitSelfSelectRestockRequest } from '../service';
const tiers = [
  { id: 'tier30', weightGrams: 30, unit: 'g', unitQty: 1 },
  { id: 'tier50', weightGrams: 50, unit: 'g', unitQty: 1 },
];
test('multiple variants require an explicit selection, including non-weight variants', () => {
  assert.throws(() => resolveRestockVariant(tiers, {}), /請選擇具體規格/);
  assert.throws(() => resolveRestockVariant(tiers.map(t => ({...t, weightGrams: null})), {}), /請選擇具體規格/);
});
test('50g resolves to the same price tier used by merchant inventory', () => {
  assert.deepEqual(resolveRestockVariant(tiers, { weightGrams: 50 }), {weightGrams:50,variantKey:'tier50',unit:'g'});
  assert.equal(resolveTierIdFromWeightGrams(tiers, 50, 'tier50'), 'tier50');
  assert.throws(() => resolveTierIdFromWeightGrams(tiers, null), /請選擇具體規格/);
});
test('unknown, conflicting, fractional, and duplicate-weight variants fail closed', () => {
  for (const input of [{weightGrams: 99}, {weightGrams: NaN}, {weightGrams: 0}, {weightGrams:50.5}, {variantKey:'another-product'}, {variantKey:'tier30',weightGrams:50}]) {
    assert.throws(() => resolveRestockVariant(tiers, input));
  }
  const duplicate = [...tiers, {...tiers[1],id:'tier50-double',unitQty:2}];
  assert.throws(() => resolveRestockVariant(duplicate, {weightGrams:50}));
  assert.equal(resolveRestockVariant(duplicate, {variantKey:'tier50-double'}).variantKey, 'tier50-double');
});
test('a piece-only product cannot be relabeled 50g', () => {
  assert.throws(() => resolveRestockVariant([{id:'piece',weightGrams:null,unit:'片',unitQty:1}], {weightGrams:50}));
});
test('unambiguous single-tier and legacy no-tier products remain supported', () => {
  assert.equal(resolveRestockVariant([tiers[1]], {}).weightGrams,50);
  assert.equal(resolveTierIdFromWeightGrams([],null),'');
});
test('SELF_SELECT rejects missing or invalid variants before creating any request', async () => {
  const products = [{id:'p',name:'豬耳朵條',productCategory:'STANDARD',priceTiers:tiers}];
  const oldRead = prisma.product.findMany;
  const oldCreate = prisma.restockRequest.create;
  const create = mock.fn(async (args: unknown) => args);
  prisma.product.findMany = (async () => products) as any;
  prisma.restockRequest.create = create as any;
  try {
    for (const spec of [{}, {weightGrams:999}, {variantKey:'foreign'}]) {
      await assert.rejects(submitSelfSelectRestockRequest({merchantId:'m',merchantUserId:'u',items:[{productId:'p',quantity:3,...spec}]}), /規格/);
    }
    assert.equal(create.mock.callCount(),0);
    await submitSelfSelectRestockRequest({merchantId:'m',merchantUserId:'u',items:[{productId:'p',quantity:3,weightGrams:50}]});
    const args = create.mock.calls[0].arguments[0] as any;
    assert.deepEqual(args.data.items.create[0], {productId:'p',requestedQuantity:3,approvedQuantity:3,weightGrams:50,variantKey:'tier50'});
    assert.equal(args.data.merchantId,'m');
  } finally { prisma.product.findMany = oldRead; prisma.restockRequest.create = oldCreate; }
});

test('approval carries the selected identity through order, shipment, snapshot and inventory', async () => {
  const { approveAndConvertRestockRequest } = await import('../service');
  const { applyMerchantRestockFromShipment } = await import('@/lib/merchant-restock-inventory');
  const writes: Record<string, any> = {};
  const product = {id:'p',name:'豬耳朵條',sku:'P',unit:'包',productCategory:'STANDARD',priceTiers:tiers};
  const request = {id:'r',merchantId:'m',shipmentId:null,items:[{productId:'p',approvedQuantity:3,weightGrams:50,variantKey:'tier50'}],merchant:{name:'店家',preferredCarrier:null},approvedAt:null};
  const tx: any = {
    restockRequest: {updateMany:async () => ({count:1}),findUnique:async () => request,update:async ({data}:any) => {writes.snapshot=data.approvedSnapshot;return data;}},
    product: {findMany:async () => [product]},
    order: {findFirst:async () => null,create:async ({data}:any) => {writes.order=data;return {id:'o'};}},
    shipment: {findFirst:async () => null,create:async ({data}:any) => {writes.shipment=data;return {id:'s'};}},
    merchantStockTxn: {findMany:async () => [],findFirst:async () => null,create:async ({data}:any) => data},
    merchantStock: {upsert:async ({create}:any) => {writes.stock=create;return create;}},
  };
  const original = prisma.$transaction;
  prisma.$transaction = (async (fn:any) => fn(tx)) as any;
  try {
    await approveAndConvertRestockRequest({requestId:'r',hqUserId:'hq',expectedArrivalDate:new Date('2026-09-20')});
    for (const line of [writes.order.items.create[0],writes.shipment.items.create[0],writes.snapshot[0]]) {
      assert.equal(line.weightGrams,50);assert.equal(line.quantity,3);assert.equal(line.productId,'p');
    }
    assert.equal(writes.shipment.items.create[0].variantKey,'tier50');
    await applyMerchantRestockFromShipment(tx,{shipmentNumber:writes.shipment.shipmentNumber,merchantId:'m',items:[{id:'si',...writes.shipment.items.create[0]}]},new Date());
    assert.equal(writes.stock.tierId,'tier50');assert.equal(writes.stock.quantity,3);assert.equal(writes.stock.merchantId,'m');
    request.items[0].weightGrams = null as any; request.items[0].variantKey = null as any;
    delete writes.order; delete writes.shipment;
    await assert.rejects(approveAndConvertRestockRequest({requestId:'r',hqUserId:'hq',expectedArrivalDate:new Date('2026-09-20')}),/規格/);
    assert.equal(writes.order,undefined);assert.equal(writes.shipment,undefined);
  } finally { prisma.$transaction=original; }
});


test('a confirmed 50g piece preserves its existing tier identity and counting unit', async () => {
  const { restockTierLabel } = await import('../variant');
  const { formatRestockItemSpec } = await import('../constants');
  const piece = {id:'piece-existing',weightGrams:50,unit:'片',unitQty:1};
  const result = resolveRestockVariant([piece], {});
  assert.deepEqual(result,{weightGrams:50,variantKey:'piece-existing',unit:'片'});
  assert.equal(restockTierLabel(piece),'1 片（50g）');
  assert.equal(formatRestockItemSpec('原味雞霸',50,'片'),'原味雞霸 50g／片');
});
