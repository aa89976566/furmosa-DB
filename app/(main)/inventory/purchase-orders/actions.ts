'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { parseMoneyToCents } from '@/lib/inventory/purchase-cost';
import { allPurchaseLinesConfirmed, createPurchaseOrder, receivePurchaseOrder } from '@/lib/inventory/purchase-orders';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function signatureOk(type: string, data: Buffer) {
  if (type === 'image/jpeg') return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (type === 'image/png') return data.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (type === 'image/webp') return data.subarray(0,4).toString() === 'RIFF' && data.subarray(8,12).toString() === 'WEBP';
  return type === 'application/pdf' && data.subarray(0,5).toString() === '%PDF-';
}

function safeError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : '';
  return raw && raw.length <= 180 && !raw.includes('Invalid `prisma') && !raw.includes('DATABASE_URL') ? raw : fallback;
}

async function requireInventoryUser() {
  const user = await getCurrentUser();
  if (!user || !['admin','warehouse','finance'].includes(user.role)) throw new Error('你沒有採購入庫權限');
  return user;
}

export async function createPendingPurchaseOrder(formData: FormData) {
  let destination = '/inventory/purchase-orders/new';
  try {
    const user = await requireInventoryUser();
    const productIds = formData.getAll('productId').map(String);
    const quantities = formData.getAll('quantityGrams').map(String);
    const amounts = formData.getAll('rawAmount').map(String);
    const items = productIds.map((productId, index) => ({ productId: productId.trim(), index })).filter((x) => x.productId).map(({ productId, index }) => ({
      productId,
      quantityGrams: Number(quantities[index]),
      rawAmountCents: parseMoneyToCents(amounts[index] ?? '', '品項金額'),
    }));
    const files = formData.getAll('attachments').filter((x): x is File => x instanceof File && x.size > 0);
    if (files.length > 3) throw new Error('單據照片最多 3 個檔案');
    const attachments = await Promise.all(files.map(async (file) => {
      if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_BYTES) throw new Error('單據只接受 5MB 內的 JPG、PNG、WebP 或 PDF');
      const data = Buffer.from(await file.arrayBuffer());
      if (!signatureOk(file.type, data)) throw new Error('單據檔案內容與格式不符');
      return { fileName: file.name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0,180), mimeType: file.type, data };
    }));
    const remindText = String(formData.get('remindFromDate') ?? '');
    const remindFromDate = new Date(`${remindText}T00:00:00+08:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(remindText) || Number.isNaN(remindFromDate.getTime())) throw new Error('請選擇提醒日期');
    const order = await createPurchaseOrder(prisma, {
      vendorId: String(formData.get('vendorId') ?? '').trim() || null,
      warehouseId: String(formData.get('warehouseId') ?? '').trim(),
      supplierDocumentNumber: String(formData.get('supplierDocumentNumber') ?? '').trim() || null,
      remindFromDate,
      shippingCostCents: parseMoneyToCents(formData.get('shippingCost'), '運費'),
      packagingCostCents: parseMoneyToCents(formData.get('packagingCost'), '包材費'),
      processingCostCents: parseMoneyToCents(formData.get('processingCost'), '加工費'),
      taxAmountCents: parseMoneyToCents(formData.get('taxAmount'), '稅額'),
      discountAmountCents: parseMoneyToCents(formData.get('discountAmount'), '折扣'),
      note: String(formData.get('note') ?? '').trim() || null,
      createdById: user.userId,
      items,
      attachments,
    });
    destination = `/inventory/purchase-orders/${order.id}?created=1`;
  } catch (error) {
    destination = `/inventory/purchase-orders/new?error=${encodeURIComponent(safeError(error, '建立採購單失敗，資料沒有變更'))}`;
  }
  redirect(destination);
}

export async function confirmPurchaseOrderReceipt(formData: FormData) {
  const id = String(formData.get('purchaseOrderId') ?? '');
  let destination = `/inventory/purchase-orders/${id}`;
  try {
    const user = await requireInventoryUser();
    const checked = formData.getAll('confirmedLine').map(String);
    const lines = await prisma.purchaseOrderItem.findMany({ where: { purchaseOrderId: id }, select: { id: true } });
    if (!allPurchaseLinesConfirmed(lines.map((line) => line.id), checked)) {
      throw new Error('請逐項核對全部商品後再確認實收');
    }
    const result = await receivePurchaseOrder(prisma, id, user.userId);
    revalidatePath('/inventory'); revalidatePath('/inventory/purchases'); revalidatePath('/dashboard');
    destination = `/inventory/purchases/${result.receipt.id}?received=1`;
  } catch (error) {
    destination = `/inventory/purchase-orders/${id}?error=${encodeURIComponent(safeError(error, '確認實收失敗，庫存沒有變更'))}`;
  }
  redirect(destination);
}
