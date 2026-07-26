import { randomBytes } from 'node:crypto';
import {
  ACTIVE_APP_STATUSES,
  APP_STATUS,
  FLOW_STATE,
  JIBA_CAMPAIGN_SLUG,
  JIBA_LICENSE_VERSION,
  JIBA_SHIPPING_FEE,
  JIBA_SUPERVISOR_NAME,
  type FlowState,
} from '@/lib/campaigns/jiba-two-piece/constants';
import { recordStatusTransition } from '@/lib/campaigns/jiba-two-piece/audit';
import { ensureJibaCampaignSchema } from '@/lib/campaigns/jiba-two-piece/ensure-schema';
import { findCustomerByLineUserId } from '@/lib/line/bind-customer';
import { lineAssetUrl } from '@/lib/line/flex-hubs';
import { prisma } from '@/lib/prisma';

function ymd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

async function nextCampaignOrderNumber() {
  const prefix = `ORD-${ymd()}-`;
  const last = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
  });
  const seq = last ? Number(last.orderNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

export async function ensureJibaCampaign() {
  await ensureJibaCampaignSchema();
  const cover = lineAssetUrl('/line/events/jiba-unbox-cover.png');
  return prisma.campaign.upsert({
    where: { slug: JIBA_CAMPAIGN_SLUG },
    create: {
      id: 'camp_jiba_two_piece',
      slug: JIBA_CAMPAIGN_SLUG,
      name: '雞霸兩片開箱',
      status: 'active',
      coverImageUrl: cover,
      productName: '雞霸',
      productQuantity: 2,
      productUnitPrice: 0,
      shippingFee: JIBA_SHIPPING_FEE,
      licenseVersion: JIBA_LICENSE_VERSION,
    },
    update: {
      status: 'active',
      coverImageUrl: cover,
      shippingFee: JIBA_SHIPPING_FEE,
    },
  });
}

export async function findActiveJibaApplication(lineUserId: string) {
  const campaign = await ensureJibaCampaign();
  return prisma.campaignApplication.findFirst({
    where: {
      campaignId: campaign.id,
      lineUserId,
      status: { in: [...ACTIVE_APP_STATUSES] },
    },
    include: { conversationSession: true, campaign: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createJibaEnrollment(opts: {
  lineUserId: string;
  lineDisplayName?: string | null;
}) {
  const campaign = await ensureJibaCampaign();
  const existing = await findActiveJibaApplication(opts.lineUserId);
  if (existing) return existing;

  const customer = await findCustomerByLineUserId(opts.lineUserId);
  const orderNumber = await nextCampaignOrderNumber();
  const order = await prisma.order.create({
    data: {
      orderNumber,
      source: 'line',
      status: 'draft',
      paymentStatus: 'unpaid',
      shippingFeeType: 'unpaid',
      fulfillmentStatus: 'pending',
      customerId: customer?.id ?? null,
      subtotal: 0,
      discount: 0,
      shippingFee: JIBA_SHIPPING_FEE,
      companyShippingCost: 0,
      giftCost: 0,
      total: JIBA_SHIPPING_FEE,
      shippingMethod: 'convenience',
      cvsBrand: '711',
      note: '[雞霸兩片開箱] DRAFT',
    },
  });

  const application = await prisma.campaignApplication.create({
    data: {
      campaignId: campaign.id,
      customerId: customer?.id ?? null,
      lineUserId: opts.lineUserId,
      lineDisplayName: opts.lineDisplayName ?? customer?.lineDisplay ?? null,
      orderId: order.id,
      status: APP_STATUS.COLLECTING_INFO,
      shippingQueueStatus: 'NOT_READY',
      paymentStatus: 'unpaid',
    },
  });

  const session = await prisma.conversationSession.create({
    data: {
      lineUserId: opts.lineUserId,
      campaignApplicationId: application.id,
      currentState: FLOW_STATE.ASK_RECIPIENT_NAME,
      collectedDataJson: '{}',
    },
  });

  await recordStatusTransition({
    entityType: 'campaign_application',
    entityId: application.id,
    previousStatus: null,
    newStatus: APP_STATUS.COLLECTING_INFO,
    actorType: 'bot',
    applicationId: application.id,
  });
  await recordStatusTransition({
    entityType: 'order',
    entityId: order.id,
    previousStatus: null,
    newStatus: 'draft',
    actorType: 'bot',
    applicationId: application.id,
  });

  return prisma.campaignApplication.findUniqueOrThrow({
    where: { id: application.id },
    include: { conversationSession: true, campaign: true },
  });
}

export async function appendConversationMessage(opts: {
  sessionId: string;
  senderType: 'customer' | 'bot' | 'system' | 'supervisor';
  text: string;
  messageType?: string;
  lineMessageId?: string | null;
  extra?: Record<string, unknown>;
}) {
  await prisma.conversationMessage.create({
    data: {
      sessionId: opts.sessionId,
      senderType: opts.senderType,
      messageType: opts.messageType ?? 'text',
      lineMessageId: opts.lineMessageId ?? null,
      contentJson: JSON.stringify({ text: opts.text, ...opts.extra }),
    },
  });
}

export async function setConversationState(
  sessionId: string,
  state: FlowState,
  collectedPatch?: Record<string, unknown>,
) {
  const session = await prisma.conversationSession.findUniqueOrThrow({
    where: { id: sessionId },
  });
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(session.collectedDataJson || '{}') as Record<string, unknown>;
  } catch {
    data = {};
  }
  if (collectedPatch) data = { ...data, ...collectedPatch };
  return prisma.conversationSession.update({
    where: { id: sessionId },
    data: {
      currentState: state,
      collectedDataJson: JSON.stringify(data),
    },
  });
}

export async function syncApplicationFields(
  applicationId: string,
  fields: {
    recipientName?: string | null;
    recipientPhone?: string | null;
    storeId?: string | null;
    storeName?: string | null;
    storeAddress?: string | null;
    instagramHandle?: string | null;
    petName?: string | null;
  },
) {
  const data: Record<string, string | null> = {};
  if ('recipientName' in fields) data.recipientName = fields.recipientName ?? null;
  if ('recipientPhone' in fields) data.recipientPhone = fields.recipientPhone ?? null;
  if ('storeId' in fields) data.storeId = fields.storeId ?? null;
  if ('storeName' in fields) data.storeName = fields.storeName ?? null;
  if ('storeAddress' in fields) data.storeAddress = fields.storeAddress ?? null;
  if ('instagramHandle' in fields) data.instagramHandle = fields.instagramHandle ?? null;
  if ('petName' in fields) data.petName = fields.petName ?? null;

  const app = await prisma.campaignApplication.update({
    where: { id: applicationId },
    data,
  });

  if (app.orderId) {
    await prisma.order.update({
      where: { id: app.orderId },
      data: {
        cvsBrand: '711',
        ...(fields.storeId !== undefined ? { cvsStoreId: fields.storeId } : {}),
        ...(fields.storeName !== undefined ? { cvsStoreName: fields.storeName } : {}),
        ...(fields.storeAddress !== undefined
          ? { shippingAddress: fields.storeAddress }
          : {}),
        shippingMethod: 'convenience',
        note: [
          '[雞霸兩片開箱]',
          app.recipientName ? `收件：${app.recipientName}` : null,
          app.recipientPhone ? `手機：${app.recipientPhone}` : null,
          app.storeName ? `門市：${app.storeName}` : null,
          app.instagramHandle ? `IG：${app.instagramHandle}` : null,
          app.petName ? `毛孩：${app.petName}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    });
  }
  return app;
}

export async function submitForReview(applicationId: string) {
  const app = await prisma.campaignApplication.findUniqueOrThrow({
    where: { id: applicationId },
  });
  const prev = app.status;
  const updated = await prisma.campaignApplication.update({
    where: { id: applicationId },
    data: {
      status: APP_STATUS.PENDING_REVIEW,
      shippingQueueStatus: 'NOT_READY',
    },
  });
  if (app.orderId) {
    await prisma.order.update({
      where: { id: app.orderId },
      data: { status: 'pending_review' },
    });
  }
  await setConversationState(
    (await prisma.conversationSession.findUniqueOrThrow({
      where: { campaignApplicationId: applicationId },
    })).id,
    FLOW_STATE.PENDING_REVIEW,
  );
  await recordStatusTransition({
    entityType: 'campaign_application',
    entityId: applicationId,
    previousStatus: prev,
    newStatus: APP_STATUS.PENDING_REVIEW,
    actorType: 'customer',
    applicationId,
  });
  return updated;
}

export async function approveAndCreatePayment(opts: {
  applicationId: string;
  reviewerName?: string;
  note?: string;
}) {
  const token = randomBytes(24).toString('hex');
  const app = await prisma.campaignApplication.findUniqueOrThrow({
    where: { id: opts.applicationId },
  });
  if (
    app.status === APP_STATUS.AWAITING_SHIPPING_PAYMENT ||
    app.status === APP_STATUS.APPROVED
  ) {
    // 冪等：已通過則沿用既有 paymentToken
    if (app.paymentToken) return app;
  }
  if (app.status !== APP_STATUS.PENDING_REVIEW) {
    throw new Error(`申請狀態不可審核通過：${app.status}`);
  }
  const prev = app.status;
  const updated = await prisma.campaignApplication.update({
    where: { id: opts.applicationId },
    data: {
      // 審核通過後立刻進入等運費；application 以 AWAITING 為可操作狀態
      status: APP_STATUS.AWAITING_SHIPPING_PAYMENT,
      shippingQueueStatus: 'NOT_READY',
      reviewedBy: opts.reviewerName ?? JIBA_SUPERVISOR_NAME,
      reviewedAt: new Date(),
      reviewNote: opts.note ?? null,
      paymentToken: token,
      paymentStatus: 'unpaid',
    },
  });
  if (app.orderId) {
    await prisma.order.update({
      where: { id: app.orderId },
      data: { status: 'awaiting_shipping_payment', paymentStatus: 'unpaid' },
    });
  }
  await prisma.orderReview.create({
    data: {
      applicationId: opts.applicationId,
      orderId: app.orderId,
      reviewerName: opts.reviewerName ?? JIBA_SUPERVISOR_NAME,
      decision: 'APPROVED',
      note: opts.note ?? null,
    },
  });
  const session = await prisma.conversationSession.findUnique({
    where: { campaignApplicationId: opts.applicationId },
  });
  if (session) {
    await setConversationState(session.id, FLOW_STATE.AWAITING_SHIPPING_PAYMENT);
  }
  await recordStatusTransition({
    entityType: 'campaign_application',
    entityId: opts.applicationId,
    previousStatus: prev,
    newStatus: APP_STATUS.APPROVED,
    actorType: 'supervisor',
    actorId: opts.reviewerName ?? JIBA_SUPERVISOR_NAME,
    applicationId: opts.applicationId,
  });
  await recordStatusTransition({
    entityType: 'campaign_application',
    entityId: opts.applicationId,
    previousStatus: APP_STATUS.APPROVED,
    newStatus: APP_STATUS.AWAITING_SHIPPING_PAYMENT,
    actorType: 'supervisor',
    actorId: opts.reviewerName ?? JIBA_SUPERVISOR_NAME,
    applicationId: opts.applicationId,
    metadata: { paymentMethod: 'bank_transfer' },
  });
  return updated;
}

async function nextShipmentNumber() {
  const prefix = `SHP-${ymd()}-`;
  const last = await prisma.shipment.findFirst({
    where: { shipmentNumber: { startsWith: prefix } },
    orderBy: { shipmentNumber: 'desc' },
  });
  const seq = last ? Number(last.shipmentNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

/** 付款成功後才建立出貨單；審核通過前絕不入列 */
async function ensureQueuedShipment(applicationId: string) {
  const app = await prisma.campaignApplication.findUniqueOrThrow({
    where: { id: applicationId },
  });
  if (!app.orderId) return;
  const existing = await prisma.shipment.findFirst({
    where: { orderId: app.orderId, status: { not: 'cancelled' } },
  });
  if (existing) return existing;

  const storeLabel = app.storeName?.trim() || '7-11';
  return prisma.shipment.create({
    data: {
      shipmentNumber: await nextShipmentNumber(),
      type: 'customer_order',
      status: 'pending',
      customerId: app.customerId,
      orderId: app.orderId,
      recipientName: app.recipientName,
      recipientPhone: app.recipientPhone,
      recipientAddress: `7-11 · ${storeLabel}${app.storeAddress ? `（${app.storeAddress}）` : ''}`,
      carrier: '7-11',
      notes: [
        '[雞霸兩片開箱]',
        app.storeId ? `店號：${app.storeId}` : null,
        app.instagramHandle ? `IG：${app.instagramHandle}` : null,
        app.petName ? `毛孩：${app.petName}` : null,
        '商品：雞霸 × 2（活動贈送）',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  });
}

export async function markShippingPaid(applicationId: string, actorType = 'payment') {
  const app = await prisma.campaignApplication.findUniqueOrThrow({
    where: { id: applicationId },
  });
  if (app.paymentStatus === 'paid' && app.status === APP_STATUS.READY_TO_SHIP) {
    await ensureQueuedShipment(applicationId);
    return app; // idempotent
  }
  if (
    app.status !== APP_STATUS.AWAITING_SHIPPING_PAYMENT &&
    app.status !== APP_STATUS.APPROVED
  ) {
    throw new Error(`申請狀態不可標記付款：${app.status}`);
  }
  const prev = app.status;
  const updated = await prisma.campaignApplication.update({
    where: { id: applicationId },
    data: {
      status: APP_STATUS.READY_TO_SHIP,
      shippingQueueStatus: 'QUEUED',
      paymentStatus: 'paid',
      paidAt: new Date(),
    },
  });
  if (app.orderId) {
    await prisma.order.update({
      where: { id: app.orderId },
      data: {
        status: 'confirmed',
        paymentStatus: 'paid',
        shippingFeeType: 'prepaid',
        fulfillmentStatus: 'pending',
      },
    });
  }
  await ensureQueuedShipment(applicationId);
  const session = await prisma.conversationSession.findUnique({
    where: { campaignApplicationId: applicationId },
  });
  if (session) {
    await setConversationState(session.id, FLOW_STATE.READY_TO_SHIP);
    await prisma.conversationSession.update({
      where: { id: session.id },
      data: { completedAt: new Date() },
    });
  }
  await recordStatusTransition({
    entityType: 'campaign_application',
    entityId: applicationId,
    previousStatus: prev,
    newStatus: APP_STATUS.READY_TO_SHIP,
    actorType,
    applicationId,
    metadata: { shippingQueueStatus: 'QUEUED' },
  });
  return updated;
}

export async function rejectApplication(opts: {
  applicationId: string;
  reviewerName?: string;
  note: string;
  reasonCode?: string;
}) {
  const app = await prisma.campaignApplication.findUniqueOrThrow({
    where: { id: opts.applicationId },
  });
  const prev = app.status;
  const updated = await prisma.campaignApplication.update({
    where: { id: opts.applicationId },
    data: {
      status: APP_STATUS.REJECTED,
      shippingQueueStatus: 'NOT_READY',
      reviewedBy: opts.reviewerName ?? JIBA_SUPERVISOR_NAME,
      reviewedAt: new Date(),
      reviewNote: opts.note,
    },
  });
  if (app.orderId) {
    await prisma.order.update({
      where: { id: app.orderId },
      data: { status: 'cancelled' },
    });
  }
  await prisma.orderReview.create({
    data: {
      applicationId: opts.applicationId,
      orderId: app.orderId,
      reviewerName: opts.reviewerName ?? JIBA_SUPERVISOR_NAME,
      decision: 'REJECTED',
      reasonCode: opts.reasonCode ?? null,
      note: opts.note,
    },
  });
  const session = await prisma.conversationSession.findUnique({
    where: { campaignApplicationId: opts.applicationId },
  });
  if (session) {
    await setConversationState(session.id, FLOW_STATE.CANCELLED);
  }
  await recordStatusTransition({
    entityType: 'campaign_application',
    entityId: opts.applicationId,
    previousStatus: prev,
    newStatus: APP_STATUS.REJECTED,
    actorType: 'supervisor',
    actorId: opts.reviewerName ?? JIBA_SUPERVISOR_NAME,
    applicationId: opts.applicationId,
    metadata: { reasonCode: opts.reasonCode, note: opts.note },
  });
  return updated;
}

export async function returnForEdit(opts: {
  applicationId: string;
  fields: string[];
  reasonCode?: string;
  note?: string;
  reviewerName?: string;
}) {
  const app = await prisma.campaignApplication.findUniqueOrThrow({
    where: { id: opts.applicationId },
    include: { conversationSession: true },
  });
  const fieldToState: Record<string, FlowState> = {
    recipient_name: FLOW_STATE.ASK_RECIPIENT_NAME,
    recipient_phone: FLOW_STATE.ASK_RECIPIENT_PHONE,
    store: FLOW_STATE.ASK_STORE,
    instagram_handle: FLOW_STATE.ASK_INSTAGRAM,
    pet_name: FLOW_STATE.ASK_PET_NAME,
    license: FLOW_STATE.ASK_CONTENT_LICENSE,
  };
  const first = opts.fields[0] ?? 'recipient_name';
  const nextState = fieldToState[first] ?? FLOW_STATE.ASK_RECIPIENT_NAME;
  const prev = app.status;
  await prisma.campaignApplication.update({
    where: { id: opts.applicationId },
    data: {
      status: APP_STATUS.COLLECTING_INFO,
      returnFields: JSON.stringify(opts.fields),
      reviewedBy: opts.reviewerName ?? JIBA_SUPERVISOR_NAME,
      reviewedAt: new Date(),
      reviewNote: opts.note ?? null,
    },
  });
  if (app.conversationSession) {
    await setConversationState(app.conversationSession.id, nextState);
  }
  await prisma.orderReview.create({
    data: {
      applicationId: opts.applicationId,
      orderId: app.orderId,
      reviewerName: opts.reviewerName ?? JIBA_SUPERVISOR_NAME,
      decision: 'RETURNED',
      reasonCode: opts.reasonCode ?? first,
      note: opts.note ?? null,
    },
  });
  await recordStatusTransition({
    entityType: 'campaign_application',
    entityId: opts.applicationId,
    previousStatus: prev,
    newStatus: APP_STATUS.COLLECTING_INFO,
    actorType: 'supervisor',
    actorId: opts.reviewerName ?? JIBA_SUPERVISOR_NAME,
    applicationId: opts.applicationId,
    metadata: { returnFields: opts.fields },
  });
  return { nextState, field: first };
}

export function paymentUrlForToken(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'https://furmosa-db.vercel.app';
  return `${base.replace(/\/$/, '')}/pay/jiba/${token}`;
}
