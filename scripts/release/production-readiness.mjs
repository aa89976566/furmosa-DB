import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const databaseUrl = required('DATABASE_URL');
const email = required('PRODUCTION_SMOKE_HQ_EMAIL').toLowerCase();
const password = required('PRODUCTION_SMOKE_HQ_PASSWORD');
const parsed = new URL(databaseUrl);
if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('Production readiness requires PostgreSQL');
if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) throw new Error('Production readiness refuses a local database');

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new Error('Production HQ smoke login credentials are invalid');
  }
  await Promise.all([
    prisma.order.findFirst({ select: { id: true }, orderBy: { createdAt: 'desc' } }),
    prisma.shipment.findFirst({ select: { id: true }, orderBy: { createdAt: 'desc' } }),
  ]);
  console.log(JSON.stringify({ ok: true, checks: ['hq-password', 'order-read', 'shipment-read'] }));
} finally {
  await prisma.$disconnect();
}
