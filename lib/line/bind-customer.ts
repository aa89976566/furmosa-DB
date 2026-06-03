import { prisma } from '@/lib/prisma';
import { fetchLineUserDisplayName } from '@/lib/line/profile';
import { CUSTOMER_ID_EXAMPLE } from '@/lib/customers/customer-id-format';

function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-()]/g, '');
}

function normalizeBindIdentifier(raw: string): string {
  return raw.trim();
}

export type BindLineCustomerResult =
  | { ok: true; customerName: string; customerCode: string }
  | { ok: false; error: string };

/**
 * 將 LINE User ID（U 開頭）寫入 Customer.lineUserId，供後台對應會員。
 * 同一 LINE 帳號只綁一位客戶；綁定新客戶時會解除其他客戶上的相同 lineUserId。
 */
export async function bindLineUserToCustomer(
  lineUserId: string,
  identifierRaw: string,
  lineDisplayHint?: string | null,
): Promise<BindLineCustomerResult> {
  const identifier = normalizeBindIdentifier(identifierRaw);
  if (!identifier) {
    return { ok: false, error: `請提供會員編號（例：${CUSTOMER_ID_EXAMPLE}）或註冊手機` };
  }

  const phoneNorm = normalizePhone(identifier);
  const customer = await prisma.customer.findFirst({
    where: {
      OR: [
        { customerId: { equals: identifier, mode: 'insensitive' } },
        ...(phoneNorm.length >= 8
          ? [{ phone: { contains: phoneNorm } }, { phone: { equals: phoneNorm } }]
          : []),
      ],
    },
    select: { id: true, name: true, customerId: true, lineUserId: true },
  });

  if (!customer) {
    return { ok: false, error: '找不到此會員，請確認編號或手機是否正確' };
  }

  const display =
    lineDisplayHint?.trim() || (await fetchLineUserDisplayName(lineUserId)) || null;

  await prisma.$transaction(async (tx) => {
    await tx.customer.updateMany({
      where: {
        lineUserId,
        id: { not: customer.id },
      },
      data: { lineUserId: null, lineDisplay: null },
    });

    await tx.customer.update({
      where: { id: customer.id },
      data: {
        lineUserId,
        lineDisplay: display,
      },
    });
  });

  return {
    ok: true,
    customerName: customer.name,
    customerCode: customer.customerId,
  };
}

export async function findCustomerByLineUserId(lineUserId: string) {
  return prisma.customer.findFirst({
    where: { lineUserId },
    select: {
      id: true,
      name: true,
      customerId: true,
      lineDisplay: true,
      signupStore: true,
      storeId: true,
      storeName: true,
    },
  });
}
