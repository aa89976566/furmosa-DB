import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import {
  ACTIVE_APP_STATUSES,
  APP_STATUS,
  FLOW_STATE,
  JIBA_CAMPAIGN_SLUG,
  JIBA_LICENSE_VERSION,
  JIBA_SHIPPING_FEE,
  JIBA_SUPERVISOR_NAME,
  PAYMENT_STATUS,
  jibaProductLabelFromCollected,
  parseCollectedDataJson,
  type FlowState,
} from '@/lib/campaigns/jiba-two-piece/constants';
import { recordStatusTransition } from '@/lib/campaigns/jiba-two-piece/audit';
import { ensureJibaCampaignSchema } from '@/lib/campaigns/jiba-two-piece/ensure-schema';
import { isMissingCampaignTableError } from '@/lib/campaigns/jiba-two-piece/missing-table';
import {
  assessJibaShippingFee,
  buildPaymentDeclarationPatch,
  decideJibaApproveTransition,
  isJibaBackfillCandidate,
  isJibaPaymentDeclared,
  JIBA_PAYMENT_METHOD_BANK_TRANSFER,
} from '@/lib/campaigns/jiba-two-piece/payment';
import { requireJibaTransferAccount } from '@/lib/campaigns/jiba-two-piece/transfer-env';
import { findCustomerByLineUserId } from '@/lib/line/bind-customer';
import { lineAssetUrl } from '@/lib/line/flex-hubs';
import { prisma } from '@/lib/prisma';

type Db = Prisma.TransactionClient | typeof prisma;

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

async function upsertJibaCampaign() {
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

/** 同一 isolate 內快取活動列，避免每次 lookup 都 upsert */
let cachedCampaign:
  | Awaited<ReturnType<typeof upsertJibaCampaign>>
  | null = null;

/**
 * 確保雞霸開箱活動列存在。
 * 表缺失時先跑 idempotent DDL（migrate soft-fail 補償），再重試 upsert。
 */
export async function ensureJibaCampaign() {
  if (cachedCampaign) return cachedCampaign;
  try {
    cachedCampaign = await upsertJibaCampaign();
    return cachedCampaign;
  } catch (err) {
    if (!isMissingCampaignTableError(err)) throw err;
    await ensureJibaCampaignSchema();
    cachedCampaign = await upsertJibaCampaign();
    return cachedCampaign;
  }
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
  // 直接查，避免再走一輪 ensure＋findActive
  const existing = await prisma.campaignApplication.findFirst({
    where: {
      campaignId: campaign.id,
      lineUserId: opts.lineUserId,
      status: { in: [...ACTIVE_APP_STATUSES] },
    },
    include: { conversationSession: true, campaign: true },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return existing;

  const [customer, orderNumber] = await Promise.all([
    findCustomerByLineUserId(opts.lineUserId),
    nextCampaignOrderNumber(),
  ]);
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

  await prisma.conversationSession.create({
    data: {
      lineUserId: opts.lineUserId,
      campaignApplicationId: application.id,
      currentState: FLOW_STATE.ASK_PRODUCT,
      collectedDataJson: '{}',
    },
  });

  // 稽核 log 不擋回覆；背景寫入
  void Promise.all([
    recordStatusTransition({
      entityType: 'campaign_application',
      entityId: application.id,
      previousStatus: null,
      newStatus: APP_STATUS.COLLECTING_INFO,
      actorType: 'bot',
      applicationId: application.id,
    }),
    recordStatusTransition({
      entityType: 'order',
      entityId: order.id,
      previousStatus: null,
      newStatus: 'draft',
      actorType: 'bot',
      applicationId: application.id,
    }),
  ]).catch((err) => console.error('[jiba] audit log failed', err));

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
  db: Db = prisma,
) {
  const session = await db.conversationSession.findUniqueOrThrow({
    where: { id: sessionId },
  });
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(session.collectedDataJson || '{}') as Record<string, unknown>;
  } catch {
    data = {};
  }
  if (collectedPatch) data = { ...data, ...collectedPatch };
  return db.conversationSession.update({
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
    const session = await prisma.conversationSession.findUnique({
      where: { campaignApplicationId: applicationId },
      select: { collectedDataJson: true },
    });
    const productLabel = jibaProductLabelFromCollected(session?.collectedDataJson);
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
          `商品：${productLabel}`,
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
  return prisma.$transaction(async (tx) => {
    const app = await tx.campaignApplication.findUniqueOrThrow({
      where: { id: opts.applicationId },
      include: { conversationSession: { select: { id: true, collectedDataJson: true } } },
    });
    const decision = decideJibaApproveTransition({
      status: app.status,
      paymentStatus: app.paymentStatus,
      collected: app.conversationSession?.collectedDataJson,
    });
    if (decision.action === 'reject') {
      throw new Error(decision.reason);
    }
    if (decision.action === 'idempotent') {
      if (decision.createShipment) {
        await ensureQueuedShipment(opts.applicationId, tx);
      }
      return tx.campaignApplication.findUniqueOrThrow({
        where: { id: opts.applicationId },
      });
    }

    const token = app.paymentToken ?? randomBytes(24).toString('hex');
    const reviewerName = opts.reviewerName ?? JIBA_SUPERVISOR_NAME;
    const locked = await tx.campaignApplication.updateMany({
      where: { id: opts.applicationId, status: app.status },
      data: {
        status: decision.nextAppStatus,
        shippingQueueStatus: decision.shippingQueueStatus,
        reviewedBy: reviewerName,
        reviewedAt: new Date(),
        reviewNote: opts.note ?? null,
        paymentToken: token,
      },
    });
    if (locked.count === 0) {
      const again = await tx.campaignApplication.findUniqueOrThrow({
        where: { id: opts.applicationId },
        include: { conversationSession: { select: { collectedDataJson: true } } },
      });
      const againDecision = decideJibaApproveTransition({
        status: again.status,
        paymentStatus: again.paymentStatus,
        collected: again.conversationSession?.collectedDataJson,
      });
      if (againDecision.action === 'queue' || again.status === APP_STATUS.READY_TO_SHIP) {
        await ensureQueuedShipment(opts.applicationId, tx);
      }
      return tx.campaignApplication.findUniqueOrThrow({ where: { id: opts.applicationId } });
    }

    const fee = assessJibaShippingFee(app.conversationSession?.collectedDataJson);
    if (app.orderId) {
      await tx.order.update({
        where: { id: app.orderId },
        data: {
          status: decision.nextOrderStatus,
          paymentStatus:
            app.paymentStatus === PAYMENT_STATUS.PAID ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.UNPAID,
          shippingFeeType: !fee.due ? 'free' : decision.action === 'queue' ? 'prepaid' : 'unpaid',
          shippingFee: fee.due ? JIBA_SHIPPING_FEE : 0,
          total: fee.due ? JIBA_SHIPPING_FEE : 0,
          fulfillmentStatus: 'pending',
        },
      });
    }

    const existingReview = await tx.orderReview.findFirst({
      where: { applicationId: opts.applicationId, decision: 'APPROVED' },
    });
    if (!existingReview) {
      await tx.orderReview.create({
        data: {
          applicationId: opts.applicationId,
          orderId: app.orderId,
          reviewerName,
          decision: 'APPROVED',
          note: opts.note ?? null,
        },
      });
    }

    if (decision.createShipment) {
      await ensureQueuedShipment(opts.applicationId, tx);
    }

    if (app.conversationSession) {
      await setConversationState(
        app.conversationSession.id,
        decision.nextAppStatus === APP_STATUS.READY_TO_SHIP
          ? FLOW_STATE.READY_TO_SHIP
          : FLOW_STATE.AWAITING_SHIPPING_PAYMENT,
        undefined,
        tx,
      );
    }

    await recordStatusTransition({
      entityType: 'campaign_application',
      entityId: opts.applicationId,
      previousStatus: app.status,
      newStatus: APP_STATUS.APPROVED,
      actorType: 'supervisor',
      actorId: reviewerName,
      applicationId: opts.applicationId,
      db: tx,
    });
    await recordStatusTransition({
      entityType: 'campaign_application',
      entityId: opts.applicationId,
      previousStatus: APP_STATUS.APPROVED,
      newStatus: decision.nextAppStatus,
      actorType: 'supervisor',
      actorId: reviewerName,
      applicationId: opts.applicationId,
      metadata: {
        paymentMethod: JIBA_PAYMENT_METHOD_BANK_TRANSFER,
        paymentStatus: app.paymentStatus,
        queued: decision.createShipment,
      },
      db: tx,
    });

    return tx.campaignApplication.findUniqueOrThrow({
      where: { id: opts.applicationId },
    });
  });
}

async function nextShipmentNumber(db: Db = prisma) {
  const prefix = `SHP-${ymd()}-`;
  const last = await db.shipment.findFirst({
    where: { shipmentNumber: { startsWith: prefix } },
    orderBy: { shipmentNumber: 'desc' },
  });
  const seq = last ? Number(last.shipmentNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

/** 審核通過且付款條件滿足後才建立出貨單；已存在則沿用 */
async function ensureQueuedShipment(applicationId: string, db: Db = prisma) {
  const app = await db.campaignApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: { conversationSession: { select: { collectedDataJson: true } } },
  });
  if (!app.orderId) return;
  const existing = await db.shipment.findFirst({
    where: { orderId: app.orderId, status: { not: 'cancelled' } },
  });
  if (existing) return existing;

  const storeLabel = app.storeName?.trim() || '7-11';
  const productLabel = jibaProductLabelFromCollected(
    app.conversationSession?.collectedDataJson,
  );
  return db.shipment.create({
    data: {
      shipmentNumber: await nextShipmentNumber(db),
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
        `商品：${productLabel}（活動贈送）`,
      ]
        .filter(Boolean)
        .join('\n'),
    },
  });
}

export async function declareJibaShippingPayment(opts: {
  applicationId: string;
  lineMessageId?: string | null;
  actorType?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.campaignApplication.findUniqueOrThrow({
      where: { id: opts.applicationId },
      include: { conversationSession: true },
    });
    const collected = parseCollectedDataJson(app.conversationSession?.collectedDataJson);
    if (
      opts.lineMessageId &&
      collected.declarationSourceMsgId &&
      collected.declarationSourceMsgId === opts.lineMessageId
    ) {
      return { app, alreadyDeclared: true as const };
    }
    if (isJibaPaymentDeclared(app.paymentStatus, collected)) {
      return { app, alreadyDeclared: true as const };
    }

    const fee = assessJibaShippingFee(collected);
    if (!fee.due) {
      return { app, alreadyDeclared: true as const, waived: true as const };
    }

    const transfer = requireJibaTransferAccount();
    const declaration = buildPaymentDeclarationPatch({
      accountLast5: transfer?.accountLast5 ?? '',
      amount: fee.amount,
    });
    const nextCollected = {
      ...collected,
      ...declaration,
      declarationSourceMsgId: opts.lineMessageId ?? collected.declarationSourceMsgId ?? null,
    };

    const locked = await tx.campaignApplication.updateMany({
      where: {
        id: opts.applicationId,
        paymentStatus: { in: [PAYMENT_STATUS.UNPAID, PAYMENT_STATUS.FAILED] },
      },
      data: { paymentStatus: PAYMENT_STATUS.DECLARED },
    });
    if (locked.count === 0 && isJibaPaymentDeclared(app.paymentStatus, collected)) {
      return { app, alreadyDeclared: true as const };
    }
    if (locked.count === 0 && app.paymentStatus !== PAYMENT_STATUS.UNPAID) {
      return { app, alreadyDeclared: true as const };
    }

    if (app.conversationSession) {
      await tx.conversationSession.update({
        where: { id: app.conversationSession.id },
        data: { collectedDataJson: JSON.stringify(nextCollected) },
      });
    }

    const approvedAlready =
      app.status === APP_STATUS.AWAITING_SHIPPING_PAYMENT ||
      app.status === APP_STATUS.APPROVED;
    if (approvedAlready) {
      await tx.campaignApplication.update({
        where: { id: opts.applicationId },
        data: {
          status: APP_STATUS.READY_TO_SHIP,
          shippingQueueStatus: 'QUEUED',
          paymentStatus: PAYMENT_STATUS.DECLARED,
        },
      });
      if (app.orderId) {
        await tx.order.update({
          where: { id: app.orderId },
          data: {
            status: 'confirmed',
            paymentStatus: PAYMENT_STATUS.UNPAID,
            shippingFeeType: 'prepaid',
            fulfillmentStatus: 'pending',
          },
        });
      }
      await ensureQueuedShipment(opts.applicationId, tx);
      if (app.conversationSession) {
        await setConversationState(
          app.conversationSession.id,
          FLOW_STATE.READY_TO_SHIP,
          undefined,
          tx,
        );
      }
    }

    await recordStatusTransition({
      entityType: 'campaign_application',
      entityId: opts.applicationId,
      previousStatus: app.paymentStatus,
      newStatus: PAYMENT_STATUS.DECLARED,
      actorType: opts.actorType ?? 'customer',
      applicationId: opts.applicationId,
      metadata: {
        paymentMethod: declaration.paymentMethod,
        declaredAmount: declaration.declaredAmount,
        transferAccountLast5: declaration.transferAccountLast5,
        queued: approvedAlready,
      },
      db: tx,
    });

    return {
      app: await tx.campaignApplication.findUniqueOrThrow({
        where: { id: opts.applicationId },
      }),
      alreadyDeclared: false as const,
    };
  });
}

export async function markShippingPaid(applicationId: string, actorType = 'payment') {
  const app = await prisma.campaignApplication.findUniqueOrThrow({
    where: { id: applicationId },
  });
  if (app.paymentStatus === PAYMENT_STATUS.PAID && app.status === APP_STATUS.READY_TO_SHIP) {
    await ensureQueuedShipment(applicationId);
    return app; // idempotent
  }
  if (
    app.status !== APP_STATUS.AWAITING_SHIPPING_PAYMENT &&
    app.status !== APP_STATUS.APPROVED &&
    app.status !== APP_STATUS.READY_TO_SHIP
  ) {
    throw new Error(`申請狀態不可標記付款：${app.status}`);
  }
  const prev = app.status;
  const updated = await prisma.campaignApplication.update({
    where: { id: applicationId },
    data: {
      status: APP_STATUS.READY_TO_SHIP,
      shippingQueueStatus: 'QUEUED',
      paymentStatus: PAYMENT_STATUS.PAID,
      paidAt: new Date(),
    },
  });
  if (app.orderId) {
    await prisma.order.update({
      where: { id: app.orderId },
      data: {
        status: 'confirmed',
        paymentStatus: PAYMENT_STATUS.PAID,
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

export type JibaShippingBackfillResult = {
  dryRun: boolean;
  scanned: number;
  candidates: Array<{
    applicationId: string;
    orderId: string | null;
    status: string;
    paymentStatus: string;
    shippingQueueStatus: string;
  }>;
  repaired: number;
};

/** 已核准且付款條件已滿足、卻沒有出貨單的申請。預設 dry-run，不自動跑正式環境。 */
export async function backfillJibaReadyToShip(opts?: {
  dryRun?: boolean;
  limit?: number;
}): Promise<JibaShippingBackfillResult> {
  const dryRun = opts?.dryRun !== false;
  const campaign = await ensureJibaCampaign();
  const rows = await prisma.campaignApplication.findMany({
    where: {
      campaignId: campaign.id,
      status: {
        in: [
          APP_STATUS.APPROVED,
          APP_STATUS.AWAITING_SHIPPING_PAYMENT,
          APP_STATUS.READY_TO_SHIP,
        ],
      },
    },
    include: { conversationSession: { select: { collectedDataJson: true } } },
    take: opts?.limit ?? 200,
    orderBy: { createdAt: 'asc' },
  });

  const candidates: JibaShippingBackfillResult['candidates'] = [];
  for (const app of rows) {
    const hasActiveShipment = app.orderId
      ? Boolean(
          await prisma.shipment.findFirst({
            where: { orderId: app.orderId, status: { not: 'cancelled' } },
            select: { id: true },
          }),
        )
      : false;
    if (
      !isJibaBackfillCandidate({
        appStatus: app.status,
        paymentStatus: app.paymentStatus,
        collected: app.conversationSession?.collectedDataJson,
        hasActiveShipment,
      })
    ) {
      continue;
    }
    candidates.push({
      applicationId: app.id,
      orderId: app.orderId,
      status: app.status,
      paymentStatus: app.paymentStatus,
      shippingQueueStatus: app.shippingQueueStatus,
    });
  }

  if (dryRun) {
    return { dryRun: true, scanned: rows.length, candidates, repaired: 0 };
  }

  let repaired = 0;
  for (const item of candidates) {
    await prisma.$transaction(async (tx) => {
      await tx.campaignApplication.update({
        where: { id: item.applicationId },
        data: {
          status: APP_STATUS.READY_TO_SHIP,
          shippingQueueStatus: 'QUEUED',
        },
      });
      if (item.orderId) {
        await tx.order.update({
          where: { id: item.orderId },
          data: {
            status: 'confirmed',
            fulfillmentStatus: 'pending',
          },
        });
      }
      await ensureQueuedShipment(item.applicationId, tx);
      await recordStatusTransition({
        entityType: 'campaign_application',
        entityId: item.applicationId,
        previousStatus: item.status,
        newStatus: APP_STATUS.READY_TO_SHIP,
        actorType: 'system',
        applicationId: item.applicationId,
        metadata: { repair: 'jiba_shipping_backfill' },
        db: tx,
      });
    });
    repaired += 1;
  }

  return { dryRun: false, scanned: rows.length, candidates, repaired };
}
