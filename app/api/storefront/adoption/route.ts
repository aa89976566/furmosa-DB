import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adoptionHeaders, publicAnimal } from '@/lib/adoption/public-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const headers = adoptionHeaders(request.headers.get('origin'));
  try {
    const [rows, latestRun, latestSuccess, pending, total] = await Promise.all([
      prisma.adoptionSourceRecord.findMany({ where: { source: 'loverabbit', published: true }, select: { data: true, lastCheckedAt: true, sourceStatus: true }, orderBy: { sourceId: 'desc' }, take: 250 }),
      prisma.adoptionSyncRun.findFirst({ where: { source: 'loverabbit' }, orderBy: { startedAt: 'desc' }, select: { startedAt: true, finishedAt: true, status: true, origin: true, checked: true, changed: true } }),
      prisma.adoptionSyncRun.findFirst({ where: { source: 'loverabbit', status: 'success', checked: { gt: 0 } }, orderBy: { finishedAt: 'desc' }, select: { finishedAt: true } }),
      prisma.adoptionSourceRecord.count({ where: { source: 'loverabbit', lastCheckedAt: null, sourceStatus: '待確認' } }),
      prisma.adoptionSourceRecord.count({ where: { source: 'loverabbit' } }),
    ]);
    const lastSuccessfulRunAt = latestSuccess?.finishedAt || null;
    return NextResponse.json({
      source: '台灣愛兔協會', sourceUrl: 'https://www.loverabbit.org/',
      records: rows.map(publicAnimal), pending, total, ready: rows.length > 0 || total > 0 && pending === 0,
      lastSuccessfulRunAt, latestRun,
      stale: !lastSuccessfulRunAt || Date.now() - lastSuccessfulRunAt.getTime() > 90 * 60 * 1000 || rows.some(row => !row.lastCheckedAt || Date.now() - row.lastCheckedAt.getTime() > 2 * 60 * 60 * 1000),
    }, { headers });
  } catch {
    return NextResponse.json({ error: '認養資料暫時無法讀取', stale: true }, { status: 503, headers: { ...headers, 'Cache-Control': 'no-store' } });
  }
}
