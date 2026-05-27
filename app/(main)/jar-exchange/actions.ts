'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  filterValidJarCodes,
  generateJarCode,
  isValidJarCodeFormat,
  newJarBatchNo,
  normalizeJarCode,
} from '@/lib/jar-exchange/codes';
import { appendPointsLedger } from '@/lib/jar-exchange/points';
import { redeemJarCode } from '@/lib/jar-exchange/redeem-code';
import { redeemRewardForCustomer } from '@/lib/jar-exchange/redeem-reward';
import { ensureJarExchangeService, syncCustomerServices } from '@/lib/jar-exchange/services';
import { DEFAULT_BATCH_SIZE } from '@/lib/jar-exchange/print-labels';
import {
  createCustomerRecord,
  type CustomerCreateInput,
} from '@/lib/customers/create-customer';
import { parsePetFieldsFromFormData } from '@/lib/customers/pet-fields';

function revalidateJar() {
  revalidatePath('/jar-exchange/members');
  revalidatePath('/jar-exchange/manage');
  revalidatePath('/customers');
  revalidatePath('/dashboard');
}

export async function generateJarCodesBatch(
  count = DEFAULT_BATCH_SIZE,
  batchNo?: string,
): Promise<
  | { ok: true; count: number; batchNo: string; codes: string[] }
  | { ok: false; error: string }
> {
  try {
    const n = Math.min(Math.max(Math.floor(count), 1), 500);
    const batch = batchNo?.trim() || newJarBatchNo();

    const seen = new Set<string>();
    let created = 0;
    let rounds = 0;

    // 批量寫入 + skipDuplicates，避免逐筆查詢逾時
    while (created < n && rounds < 8) {
      rounds++;
      const room = n - created;
      const candidates: string[] = [];
      // 僅產生本次還需要的數量（外加少量候選以應付 DB 重複略過）
      const poolSize = room + Math.min(20, room);
      while (candidates.length < poolSize) {
        const c = generateJarCode();
        if (!seen.has(c) && isValidJarCodeFormat(c)) {
          seen.add(c);
          candidates.push(c);
        }
      }

      const toInsert = filterValidJarCodes(candidates).slice(0, room);
      if (toInsert.length === 0) continue;

      const result = await prisma.jarCode.createMany({
        data: toInsert.map((code) => ({
          code,
          batchNo: batch,
          pointValue: 1,
          status: 'unused',
        })),
        skipDuplicates: true,
      });
      created += result.count;
    }

    if (created === 0) {
      return { ok: false, error: '無法產生序號，請稍後再試' };
    }

    const rows = await prisma.jarCode.findMany({
      where: { batchNo: batch, status: 'unused' },
      orderBy: { createdAt: 'asc' },
      select: { code: true },
      take: n,
    });
    const codes = filterValidJarCodes(rows.map((r) => r.code));

    if (codes.length === 0) {
      return { ok: false, error: '批次內無有效 8 位數字序號' };
    }

    revalidateJar();
    return { ok: true, count: codes.length, batchNo: batch, codes };
  } catch (e) {
    console.error('generateJarCodesBatch', e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : '生成序號失敗',
    };
  }
}

export async function createManualJarCode(formData: FormData) {
  const code = normalizeJarCode(String(formData.get('code') ?? ''));
  const batchNo = String(formData.get('batchNo') ?? '').trim() || null;
  const productSku = String(formData.get('productSku') ?? '').trim() || null;
  const pointValue = parseInt(String(formData.get('pointValue') ?? '1'), 10) || 1;

  if (!isValidJarCodeFormat(code)) {
    return { ok: false as const, error: '序號須為 8 位數字' };
  }

  const exists = await prisma.jarCode.findUnique({ where: { code } });
  if (exists) return { ok: false as const, error: '序號已存在' };

  await prisma.jarCode.create({
    data: { code, batchNo, productSku, pointValue, status: 'unused' },
  });
  revalidateJar();
  return { ok: true as const };
}

export async function importJarCodes(formData: FormData) {
  const raw = String(formData.get('codes') ?? '');
  const batchNo = String(formData.get('batchNo') ?? '').trim() || `IMPORT-${Date.now()}`;
  const lines = raw
    .split(/[\n,;]+/)
    .map((l) => normalizeJarCode(l))
    .filter(Boolean);

  if (!lines.length) return { ok: false as const, error: '請貼上序號' };

  let created = 0;
  let skipped = 0;
  for (const code of lines) {
    if (!isValidJarCodeFormat(code)) {
      skipped++;
      continue;
    }
    try {
      await prisma.jarCode.create({
        data: { code, batchNo, pointValue: 1, status: 'unused' },
      });
      created++;
    } catch {
      skipped++;
    }
  }

  revalidateJar();
  return { ok: true as const, created, skipped };
}

export async function adminRedeemJarCode(customerId: string, code: string) {
  const result = await redeemJarCode(customerId, code);
  if (result.ok) revalidateJar();
  return result;
}

export async function manualPointsAdjustment(formData: FormData) {
  const customerId = String(formData.get('customerId') ?? '');
  const pointsChange = parseInt(String(formData.get('pointsChange') ?? ''), 10);
  const note = String(formData.get('note') ?? '').trim();

  if (!customerId || !Number.isFinite(pointsChange) || pointsChange === 0) {
    return { ok: false as const, error: '請選擇會員並填寫點數變動（不可為 0）' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await ensureJarExchangeService(tx, customerId);
      await appendPointsLedger(tx, {
        customerId,
        sourceType: 'manual_adjustment',
        pointsChange,
        note: note || '人工調整',
      });
    });
    revalidateJar();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : '調整失敗' };
  }
}

export async function createRewardCatalogItem(formData: FormData) {
  const rewardName = String(formData.get('rewardName') ?? '').trim();
  const pointsRequired = parseInt(String(formData.get('pointsRequired') ?? ''), 10);
  const couponFaceValue = parseFloat(String(formData.get('couponFaceValue') ?? ''));
  const internalCost = parseFloat(String(formData.get('internalCost') ?? ''));
  const partnerMerchantId = String(formData.get('partnerMerchantId') ?? '').trim() || null;
  const description = String(formData.get('description') ?? '').trim() || null;

  if (!rewardName || !Number.isFinite(pointsRequired) || pointsRequired < 1) {
    return { ok: false as const, error: '請填寫獎勵名稱與所需點數' };
  }

  const last = await prisma.rewardCatalog.findFirst({
    orderBy: { rewardCode: 'desc' },
    select: { rewardCode: true },
  });
  const n = last ? parseInt(last.rewardCode.replace('JAR-RWD-', ''), 10) : 0;
  const rewardCode = `JAR-RWD-${String(n + 1).padStart(3, '0')}`;

  await prisma.rewardCatalog.create({
    data: {
      rewardCode,
      rewardName,
      rewardType: 'grooming_coupon',
      pointsRequired,
      couponFaceValue: Number.isFinite(couponFaceValue) ? couponFaceValue : 0,
      internalCost: Number.isFinite(internalCost) ? internalCost : 0,
      partnerMerchantId,
      description,
      activeStatus: 'active',
    },
  });
  revalidateJar();
  return { ok: true as const };
}

export async function updateRewardCatalogItem(id: string, formData: FormData) {
  const rewardName = String(formData.get('rewardName') ?? '').trim();
  const pointsRequired = parseInt(String(formData.get('pointsRequired') ?? ''), 10);
  const couponFaceValue = parseFloat(String(formData.get('couponFaceValue') ?? ''));
  const internalCost = parseFloat(String(formData.get('internalCost') ?? ''));
  const partnerMerchantId = String(formData.get('partnerMerchantId') ?? '').trim() || null;

  await prisma.rewardCatalog.update({
    where: { id },
    data: {
      rewardName,
      pointsRequired,
      couponFaceValue,
      internalCost,
      partnerMerchantId,
    },
  });
  revalidateJar();
  return { ok: true as const };
}

export async function setRewardActiveStatus(id: string, activeStatus: 'active' | 'inactive') {
  await prisma.rewardCatalog.update({ where: { id }, data: { activeStatus } });
  revalidateJar();
}

export async function adminRedeemReward(customerId: string, rewardId: string) {
  const result = await redeemRewardForCustomer(customerId, rewardId);
  if (result.ok) revalidateJar();
  return result;
}

export async function searchCustomersForJarMember(q: string) {
  const term = q.trim();
  if (term.length < 1) return [];

  const rows = await prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { customerId: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ],
    },
    orderBy: { name: 'asc' },
    take: 40,
    select: {
      id: true,
      name: true,
      customerId: true,
      phone: true,
      services: {
        where: { serviceType: 'jar_exchange', serviceStatus: 'active' },
        select: { id: true },
      },
    },
  });

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    customerId: c.customerId,
    phone: c.phone,
    isJarMember: c.services.length > 0,
  }));
}

export async function enableJarExchangeForCustomer(customerId: string) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true },
    });
    if (!customer) {
      return { ok: false as const, error: '找不到客戶' };
    }

    const existing = await prisma.customerService.findUnique({
      where: { customerId_serviceType: { customerId, serviceType: 'jar_exchange' } },
      select: { serviceStatus: true },
    });
    if (existing?.serviceStatus === 'active') {
      return {
        ok: true as const,
        alreadyMember: true,
        customerId: customer.id,
        name: customer.name,
      };
    }

    await prisma.$transaction(async (tx) => {
      await syncCustomerServices(tx, customerId);
      await ensureJarExchangeService(tx, customerId);
    });
    revalidateJar();
    revalidatePath('/customers');
    return {
      ok: true as const,
      alreadyMember: false,
      customerId: customer.id,
      name: customer.name,
    };
  } catch (e) {
    console.error('enableJarExchangeForCustomer', e);
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : '加入失敗，請稍後再試',
    };
  }
}

export async function addJarExchangeMember(customerId: string) {
  const id = customerId?.trim();
  if (!id) return { ok: false as const, error: '請選擇客戶' };
  return enableJarExchangeForCustomer(id);
}

export async function createJarExchangeMember(input: CustomerCreateInput) {
  try {
    const created = await createCustomerRecord(input);
    const enabled = await enableJarExchangeForCustomer(created.id);
    if (!enabled.ok) {
      return { ok: false as const, error: enabled.error };
    }
    revalidatePath('/customers');
    return {
      ok: true as const,
      id: created.id,
      customerId: created.customerId,
      name: created.name,
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : '建立失敗',
    };
  }
}

export async function createJarExchangeMemberFromForm(formData: FormData) {
  const pet = parsePetFieldsFromFormData(formData);
  return createJarExchangeMember({
    name: String(formData.get('name') ?? ''),
    type: String(formData.get('type') ?? 'individual') === 'business' ? 'business' : 'individual',
    phone: String(formData.get('phone') ?? ''),
    email: String(formData.get('email') ?? ''),
    address: String(formData.get('address') ?? ''),
    lineDisplay: String(formData.get('lineDisplay') ?? ''),
    ...pet,
  });
}

export async function syncCustomerServicesAction(customerId: string) {
  await syncCustomerServices(prisma, customerId);
  revalidatePath(`/customers/${customerId}`);
}
