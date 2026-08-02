import { revalidatePath } from 'next/cache';

/** LINE／HQ 共用：換罐相關頁面快取失效 */
export function revalidateJarExchangeHq() {
  revalidatePath('/jar-exchange');
  revalidatePath('/jar-exchange/members');
  revalidatePath('/jar-exchange/stores');
  revalidatePath('/jar-exchange/manage');
  revalidatePath('/customers');
  revalidatePath('/dashboard');
}
