import { isNextRedirect } from '@/lib/is-next-redirect';

export const RESTOCK_UNKNOWN_RESULT = '無法確認出貨單是否建立，請先查看出貨清單，避免重複建立。';
const safeMessages = new Set([
  '缺少店家', '沒有選擇商品', '每筆數量需大於 0', '店家不存在', '商品不存在',
  '請填寫收件人姓名', '請填寫收件人電話', '請填寫收件地址',
  '請填寫 7-11 取件門市',
]);

export async function restockWithFeedbackUsing(
  submit: (data: FormData) => Promise<unknown>, data: FormData,
): Promise<{ status: 'success' | 'error'; message: string }> {
  try {
    await submit(data);
    return { status: 'success', message: '' };
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    const message = error instanceof Error ? error.message : '';
    return { status: 'error', message: safeMessages.has(message) ? message : RESTOCK_UNKNOWN_RESULT };
  }
}
