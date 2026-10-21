'use server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { COUNT_ROLES, parseCountQuantity } from '@/lib/inventory/workbench';
import { countInventoryQuantities, QuantityCountError, type CountLine } from '@/lib/inventory/quantity-count';
import { bustCacheTags } from '@/lib/runtime-cache';
import { CACHE_TAGS } from '@/lib/cache-tags';
export async function saveInventoryQuantities(form: FormData): Promise<{
    ok: boolean;
    message: string;
}> {
    const user = await getCurrentUser();
    if (!user || !COUNT_ROLES.includes(user.role))
        return { ok: false, message: '你沒有更新庫存權限' };
    let lines: CountLine[];
    try {
        const data: unknown = JSON.parse(String(form.get('lines') ?? ''));
        if (!Array.isArray(data) || data.length > 100)
            throw new Error();
        lines = data.map(row => {
            if (!row || typeof row !== 'object' || typeof row.productId !== 'string' ||
                (row.expectedVersion !== null && typeof row.expectedVersion !== 'string'))
                throw new Error();
            return { productId: row.productId, quantity: parseCountQuantity(row.quantity), expectedVersion: row.expectedVersion };
        });
    }
    catch {
        return { ok: false, message: '數量格式無效，請輸入 0 以上整數' };
    }
    let count: number;
    try {
        const result = await countInventoryQuantities(prisma, { actorId: user.userId,
            eventKey: String(form.get('eventKey') ?? ''), reason: String(form.get('reason') ?? ''), lines });
        count = result.count;
    }
    catch (error) {
        return { ok: false, message: error instanceof QuantityCountError ? error.message : '更新未完成，請重新整理確認庫存後再試' };
    }
    try {
        for (const path of ['/inventory', '/inventory/transactions', '/products', '/dashboard'])
            revalidatePath(path);
        await bustCacheTags(CACHE_TAGS.dashboard);
    }
    catch {
        console.error('[inventory.count] CACHE_REFRESH_FAILED');
    }
    return { ok: true, message: `已更新 ${count} 項庫存，時間與操作人員已自動記錄` };
}
