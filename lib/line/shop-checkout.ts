import { requireJibaTransferAccount } from '@/lib/campaigns/jiba-two-piece/transfer-env';
import {
  clearLineChatSession,
  getLineChatSession,
  isLineSessionRecent,
  parseLineShopDraft,
  type LineShopCartItem,
  type LineShopDraft,
  upsertLineChatSession,
} from '@/lib/line/chat-session';
import { findCustomerByLineUserId } from '@/lib/line/bind-customer';
import { listLineShopProducts } from '@/lib/line/shop-catalog';
import type { LineReplyMessage } from '@/lib/line/reply';
import { replyLineMessage, replyLineText } from '@/lib/line/reply';
import { nextSourceOrderNumber, SOURCE_ORDER_PREFIX } from '@/lib/orders/source-order-number';
import { prisma } from '@/lib/prisma';
import { SHIPPING_FEE_HOME_BLACK_CAT } from '@/lib/shipping-policy';

export const LINE_SHOP_FREE_SHIPPING_THRESHOLD = 1199;
export const LINE_SHOP_711_FEE = 60;

type ShopStep = 'CART' | 'ASK_NAME' | 'ASK_PHONE' | 'ASK_DESTINATION' | 'ASK_LAST5';
export type LineShopCartOperation = 'increment' | 'decrement' | 'remove';

export function updateLineShopCartItems(
  items: LineShopCartItem[],
  variantId: string,
  operation: LineShopCartOperation,
): LineShopCartItem[] {
  if (!items.some((item) => item.variantId === variantId)) return items.map((item) => ({ ...item }));
  if (operation === 'remove') return items.filter((item) => item.variantId !== variantId).map((item) => ({ ...item }));
  return items.flatMap((item) => {
    if (item.variantId !== variantId) return [{ ...item }];
    const quantity = operation === 'increment'
      ? Math.min(99, item.quantity + 1)
      : item.quantity - 1;
    return quantity > 0 ? [{ ...item, quantity }] : [];
  });
}

export function shopCartSubtotal(items: LineShopCartItem[]) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function resolveLineShopShipping(subtotal: number) {
  return subtotal >= LINE_SHOP_FREE_SHIPPING_THRESHOLD
    ? { mode: 'home' as const, fee: 0, label: '宅配免運' }
    : { mode: '711' as const, fee: LINE_SHOP_711_FEE, label: '7-ELEVEN 取貨' };
}

export function computeLineShopCartSummary(items: LineShopCartItem[]) {
  const subtotal = shopCartSubtotal(items);
  const shipping = resolveLineShopShipping(subtotal);
  return {
    subtotal,
    shippingMode: shipping.mode,
    shippingFee: shipping.fee,
    shippingLabel: shipping.label,
    freeShippingGap: Math.max(0, LINE_SHOP_FREE_SHIPPING_THRESHOLD - subtotal),
    total: subtotal + shipping.fee,
  };
}

function money(value: number) {
  return `NT$${Math.round(value).toLocaleString('zh-TW')}`;
}

export function buildLineShopCartMessages(draft: LineShopDraft): LineReplyMessage[] {
  const summary = computeLineShopCartSummary(draft.items);
  if (draft.items.length === 0) return [{
    type: 'flex',
    altText: '購物車目前是空的｜回商品分類逛逛',
    contents: {
      type: 'bubble', size: 'kilo',
      styles: { body: { backgroundColor: '#F8F6EF' }, footer: { backgroundColor: '#F8F6EF' } },
      body: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '18px', contents: [
        { type: 'text', text: '購物車目前是空的', size: 'lg', color: '#203E54', weight: 'bold', wrap: true },
        { type: 'text', text: '先從商品分類挑一樣喜歡的。', size: 'sm', color: '#60717D', wrap: true },
      ] },
      footer: { type: 'box', layout: 'vertical', paddingAll: '18px', paddingTop: '0px', contents: [{
        type: 'button', style: 'primary', color: '#203E54', height: 'sm',
        action: { type: 'postback', label: '開始逛商品', data: 'jd=shop_home', displayText: '開始逛商品' },
      }] },
    },
  }];
  const lines = draft.items.map((item) => {
    const variant = item.variantTitle && item.variantTitle !== '單一規格' ? `｜${item.variantTitle}` : '';
    return `${item.title}${variant} × ${item.quantity}　${money(item.price * item.quantity)}`;
  });
  const shippingLine = summary.shippingMode === 'home'
    ? `目前寄送：宅配到府，運費 NT$0（已達免運）`
    : `目前寄送：7-ELEVEN 取貨，運費 ${money(summary.shippingFee)}\n再買 ${money(summary.freeShippingGap)} → 改宅配到府、免運`;
  return [{
    type: 'flex',
    altText: `購物車 ${draft.items.reduce((sum, item) => sum + item.quantity, 0)} 件｜小計 ${money(summary.subtotal)}`,
    contents: {
      type: 'bubble', size: 'mega',
      styles: { body: { backgroundColor: '#F8F6EF' }, footer: { backgroundColor: '#F8F6EF' } },
      body: { type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '18px', contents: [
        { type: 'text', text: '購物車', size: 'xl', color: '#203E54', weight: 'bold' },
        { type: 'text', text: lines.join('\n'), size: 'sm', color: '#203E54', wrap: true },
        { type: 'separator', color: '#DEDBD5' },
        { type: 'text', text: `商品小計 ${money(summary.subtotal)}`, size: 'lg', color: '#203E54', weight: 'bold', wrap: true },
        { type: 'text', text: shippingLine, size: 'sm', color: '#60717D', wrap: true },
        { type: 'text', text: '尚未下單，金額以結帳確認為準。', size: 'xs', color: '#60717D', wrap: true },
      ] },
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '18px', paddingTop: '0px', contents: [
        { type: 'button', style: 'primary', color: '#203E54', height: 'sm', action: {
          type: 'postback', label: '結帳', data: 'jd=shop_checkout', displayText: '我要結帳',
        } },
        { type: 'button', style: 'secondary', height: 'sm', action: {
          type: 'postback', label: '繼續逛', data: 'jd=shop_home', displayText: '繼續逛',
        } },
      ] },
    },
    quickReply: { items: [
      { type: 'action', action: { type: 'postback', label: '結帳', data: 'jd=shop_checkout', displayText: '我要結帳' } },
      { type: 'action', action: { type: 'postback', label: '繼續逛', data: 'jd=shop_home', displayText: '繼續逛' } },
    ] },
  }];
}

async function save(lineUserId: string, step: ShopStep, draft: LineShopDraft) {
  return upsertLineChatSession(lineUserId, 'shop', step, draft);
}

async function currentShop(lineUserId: string) {
  const session = await getLineChatSession(lineUserId);
  if (!session || session.flow !== 'shop' || !isLineSessionRecent(session)) return null;
  return { session, draft: parseLineShopDraft(session.payload) };
}

export async function getLineShopCart(lineUserId: string) {
  const current = await currentShop(lineUserId);
  return current?.draft ?? { items: [] };
}

export async function addLineShopItem(lineUserId: string, variantId: string) {
  const products = await listLineShopProducts('all', { limit: 100 });
  const product = products.find((entry) => entry.variantId === variantId);
  if (!product) return { ok: false as const, error: '這項商品目前無法加入，請重新開啟商品列表。' };
  const current = await currentShop(lineUserId);
  const draft: LineShopDraft = current?.draft ?? { items: [] };
  const existing = draft.items.find((item) => item.variantId === variantId);
  if (existing) existing.quantity += 1;
  else draft.items.push({
    productId: product.id,
    title: product.title,
    variantId: product.variantId,
    variantTitle: product.variantTitle,
    price: product.price,
    quantity: 1,
    imageUrl: product.imageUrl,
  });
  delete draft.shippingMode;
  delete draft.recipientName;
  delete draft.phone;
  delete draft.addressOrStore;
  delete draft.orderId;
  delete draft.orderNumber;
  delete draft.checkoutKey;
  await save(lineUserId, 'CART', draft);
  return { ok: true as const, draft };
}

export async function startLineShopCheckout(replyToken: string, lineUserId: string) {
  const current = await currentShop(lineUserId);
  if (!current || current.draft.items.length === 0) {
    await replyLineMessage(replyToken, buildLineShopCartMessages({ items: [] }), { lineUserId });
    return;
  }
  const summary = computeLineShopCartSummary(current.draft.items);
  const shipping = resolveLineShopShipping(summary.subtotal);
  const draft = {
    ...current.draft,
    shippingMode: shipping.mode,
    checkoutKey: current.draft.checkoutKey ?? current.session.id,
  };
  await save(lineUserId, 'ASK_NAME', draft);
  const shippingText = shipping.mode === 'home'
    ? `商品小計 ${money(summary.subtotal)}，宅配到府，運費 NT$0（已達免運）。`
    : `商品小計 ${money(summary.subtotal)}，7-ELEVEN 取貨，運費 ${money(summary.shippingFee)}。`;
  await replyLineText(replyToken, `${shippingText}\n接下來問 3 個問題。\n\n1/3 收件人姓名？${shipping.mode === '711' ? '\n取貨時會核對證件，請填本名。' : ''}`);
}

function validPhone(text: string) {
  const normalized = text.replace(/[\s()-]/g, '');
  return /^09\d{8}$/.test(normalized) ? normalized : null;
}

function validLast5(text: string) {
  const digits = text.replace(/\D/g, '');
  return digits.length === 5 ? digits : null;
}

async function createLineShopOrder(lineUserId: string, draft: LineShopDraft) {
  if (!draft.checkoutKey) throw new Error('SHOP_CHECKOUT_KEY_MISSING');
  const shipping = resolveLineShopShipping(shopCartSubtotal(draft.items));
  const customer = await findCustomerByLineUserId(lineUserId);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: {
        externalStore_externalOrderId: {
          externalStore: 'line-chat',
          externalOrderId: draft.checkoutKey!,
        },
      },
    });
    if (existing) return existing;
    const prefix = SOURCE_ORDER_PREFIX.line;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-number:${prefix}`}))`;
    const last = await tx.order.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
      select: { orderNumber: true },
    });
    const orderNumber = nextSourceOrderNumber(prefix, last?.orderNumber);
    const tiers = await tx.productPriceTier.findMany({
      where: { shopifyVariantId: { in: draft.items.map((item) => item.variantId) }, status: 'active' },
      include: { product: true },
    });
    const byVariant = new Map(tiers.map((tier) => [tier.shopifyVariantId, tier]));
    const missing = draft.items.filter((item) => !byVariant.has(item.variantId));
    if (missing.length > 0) throw new Error(`SHOP_VARIANT_NOT_LINKED:${missing.map((item) => item.title).join('、')}`);
    const subtotal = shopCartSubtotal(draft.items);
    const note = [
      '[LINE 對話購物｜人工轉帳待核帳]',
      `收件人：${draft.recipientName}`,
      `手機：${draft.phone}`,
      shipping.mode === 'home' ? `宅配地址：${draft.addressOrStore}` : `7-ELEVEN 門市：${draft.addressOrStore}`,
    ].join('\n');
    return tx.order.create({
      data: {
        orderNumber,
        source: 'line',
        externalStore: 'line-chat',
        externalOrderId: draft.checkoutKey,
        status: 'draft',
        paymentStatus: 'unpaid',
        shippingFeeType: shipping.fee === 0 ? 'free' : 'unpaid',
        fulfillmentStatus: 'pending',
        customerId: customer?.id ?? null,
        subtotal,
        shippingFee: shipping.fee,
        companyShippingCost: shipping.mode === 'home' ? SHIPPING_FEE_HOME_BLACK_CAT : 0,
        total: subtotal + shipping.fee,
        shippingMethod: shipping.mode === 'home' ? 'home' : 'convenience',
        shippingAddress: draft.addressOrStore,
        cvsBrand: shipping.mode === '711' ? '711' : null,
        cvsStoreName: shipping.mode === '711' ? draft.addressOrStore : null,
        note,
        items: {
          create: draft.items.map((item) => {
            const tier = byVariant.get(item.variantId)!;
            return {
              variantKey: tier.variantKey || tier.sku || null,
              productId: tier.productId,
              productName: tier.product.name,
              sku: tier.sku || tier.shopifySku || `SHOPIFY-${item.variantId}`,
              quantity: item.quantity,
              unitPrice: item.price,
              subtotal: item.price * item.quantity,
              weightGrams: tier.weightGrams,
              unit: tier.unit,
            };
          }),
        },
      },
    });
  });
}

export async function handleLineShopMessage(
  replyToken: string,
  lineUserId: string,
  rawText: string,
): Promise<boolean> {
  const current = await currentShop(lineUserId);
  if (!current || current.session.step === 'CART') return false;
  const text = rawText.trim();
  const draft = current.draft;
  if (current.session.step === 'ASK_NAME') {
    if (text.length < 2 || text.length > 40) {
      await replyLineText(replyToken, '請輸入收件人姓名（2–40 個字）。');
      return true;
    }
    draft.recipientName = text;
    await save(lineUserId, 'ASK_PHONE', draft);
    await replyLineText(replyToken, `✓ 姓名：${text}\n\n2/3 收件人手機？\n例如：0912345678`);
    return true;
  }
  if (current.session.step === 'ASK_PHONE') {
    const phone = validPhone(text);
    if (!phone) {
      await replyLineText(replyToken, '手機格式好像不對，請輸入 09 開頭的 10 位數手機。');
      return true;
    }
    draft.phone = phone;
    await save(lineUserId, 'ASK_DESTINATION', draft);
    await replyLineText(replyToken, draft.shippingMode === 'home'
      ? `✓ 手機：${phone}\n\n3/3 宅配地址？\n請包含縣市、區域、路段、門牌與樓層。`
      : `✓ 手機：${phone}\n\n3/3 取貨的 7-ELEVEN 門市？\n請輸入「門市名稱＋店號」。`);
    return true;
  }
  if (current.session.step === 'ASK_DESTINATION') {
    if (text.length < 4 || text.length > 160) {
      await replyLineText(replyToken, draft.shippingMode === 'home'
        ? '請提供完整宅配地址。'
        : '請提供 7-ELEVEN 門市名稱與店號。');
      return true;
    }
    draft.addressOrStore = text;
    const transfer = requireJibaTransferAccount();
    if (!transfer) {
      await replyLineText(replyToken, '轉帳資料暫時無法載入，訂單尚未建立。請稍後再試或聯絡客服。');
      return true;
    }
    try {
      const order = await createLineShopOrder(lineUserId, draft);
      draft.orderId = order.id;
      draft.orderNumber = order.orderNumber;
      await save(lineUserId, 'ASK_LAST5', draft);
      await replyLineText(replyToken,
        `訂單 ${order.orderNumber} 已保留，應付 ${money(order.total)}。\n\n人工轉帳\n銀行：${transfer.bankName}（${transfer.bankCode}）\n帳號：${transfer.account}\n\n轉帳後請回覆帳號末 5 碼。款項仍會保持待核帳，確認入帳後才會進入出貨。`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith('SHOP_VARIANT_NOT_LINKED:')) {
        await replyLineText(replyToken, `以下商品尚未完成 HQ 規格對應，訂單沒有建立：${message.split(':').slice(1).join(':')}。請聯絡客服協助。`);
        return true;
      }
      throw err;
    }
    return true;
  }
  if (current.session.step === 'ASK_LAST5') {
    const last5 = validLast5(text);
    if (!last5) {
      await replyLineText(replyToken, '請只輸入轉出帳號末 5 碼。');
      return true;
    }
    if (!draft.orderId || !draft.orderNumber) {
      await clearLineChatSession(lineUserId);
      await replyLineText(replyToken, '找不到這次訂單，請重新從購物車結帳。');
      return true;
    }
    await prisma.order.update({
      where: { id: draft.orderId },
      data: {
        note: { set: `${(await prisma.order.findUnique({ where: { id: draft.orderId }, select: { note: true } }))?.note ?? ''}\n轉帳末五碼：${last5}\n顧客已回報，待人工核帳` },
        paymentStatus: 'unpaid',
      },
    });
    await clearLineChatSession(lineUserId);
    await replyLineText(replyToken, `收到末五碼 ${last5}。\n訂單 ${draft.orderNumber} 目前是「待人工核帳」，確認入帳後才會安排出貨。`);
    return true;
  }
  return false;
}
