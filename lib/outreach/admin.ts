import { getCurrentUser } from '../auth';
import { prisma } from '../prisma';

export async function outreachAdmin() {
  const session = await getCurrentUser();
  if (!session) return null;
  const user = await prisma.user.findUnique({where: {id: session.userId}, select: {id: true, role: true}});
  return user?.role === 'admin' ? user : null;
}
