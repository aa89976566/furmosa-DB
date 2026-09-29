'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { parseMoneyToCents } from '@/lib/inventory/purchase-cost';
import { postPurchaseReceipt } from '@/lib/inventory/post-purchase-receipt';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function hasExpectedSignature(mimeType: string, data: Buffer) {
  if (mimeType === 'image/jpeg') return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (mimeType === 'image/png') return data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/webp') return data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP';
  if (mimeType === 'application/pdf') return data.subarray(0, 5).toString() === '%PDF-';
  return false;
}

export async function createPurchaseReceipt(formData: FormData) {
  let destination = '/inventory/purchases/new';
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'warehouse', 'finance'].includes(user.role)) throw new Error('你沒有進貨入庫權限');
    const productIds = formData.getAll('productId').map(String);
    const quantities = formData.getAll('quantityGrams').map(String);
    const amounts = formData.getAll('rawAmount').map(String);
    const openingCosts = formData.getAll('openingAverageCostPerGram').map(String);
    const items = productIds.map((productId, index) => ({ productId: productId.trim(), index }))
      .filter((row) => row.productId)
      .map(({ productId, index }) => {
        const quantityGrams = Number(quantities[index]);
        if (!Number.isSafeInteger(quantityGrams) || quantityGrams <= 0) throw new Error('實收克數必須為正整數');
        const openingText = (openingCosts[index] ?? '').trim();
        if (openingText && !/^\d+(?:\.\d{1,6})?$/.test(openingText)) {
          throw new Error('首次建檔平均成本/g 格式不正確');
        }
        return {
          productId,
          quantityGrams,
          rawAmountCents: parseMoneyToCents(amounts[index] ?? '', '品項金額'),
          openingAverageCostPerGram: openingText ? Number(openingText) : null,
        };
      });
    const files = formData.getAll('attachments').filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length > 3) throw new Error('單據照片最多 3 個檔案');
    const attachments = await Promise.all(files.map(async (file) => {
      if (!ALLOWED_TYPES.has(file.type)) throw new Error('單據只接受 JPG、PNG、WebP 或 PDF');
      if (file.size > MAX_FILE_BYTES) throw new Error('每個單據檔案不可超過 5MB');
      const data = Buffer.from(await file.arrayBuffer());
      if (!hasExpectedSignature(file.type, data)) throw new Error('單據檔案內容與格式不符');
      return { fileName: file.name.slice(0, 180), mimeType: file.type, data };
    }));
    const receiptDate = new Date(`${String(formData.get('receiptDate') ?? '')}T12:00:00+08:00`);
    if (Number.isNaN(receiptDate.getTime())) throw new Error('請選擇進貨日期');
    const receipt = await postPurchaseReceipt(prisma, {
      vendorId: String(formData.get('vendorId') ?? '').trim() || null,
      warehouseId: String(formData.get('warehouseId') ?? '').trim(),
      supplierDocumentNumber: String(formData.get('supplierDocumentNumber') ?? '').trim() || null,
      receiptDate,
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
    destination = `/inventory/purchases/${receipt.id}?created=1`;
  } catch (error) {
    const raw = error instanceof Error ? error.message : '';
    const message = raw && raw.length <= 180 && !raw.includes('Invalid `prisma') && !raw.includes('DATABASE_URL')
      ? raw
      : '進貨入庫失敗，資料沒有變更，請稍後再試';
    destination = `/inventory/purchases/new?error=${encodeURIComponent(message)}`;
  }
  redirect(destination);
}
