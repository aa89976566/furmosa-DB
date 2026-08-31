import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ShopifyReconcileForm } from './shopify-reconcile-form';

export async function ShopifyReconcilePanel() {
  const session = await getCurrentUser();
  if (!session) return null;
  const actor = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } });
  return actor?.role === 'admin' ? <ShopifyReconcileForm /> : null;
}
