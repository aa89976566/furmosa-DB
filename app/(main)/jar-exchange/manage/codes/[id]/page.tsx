import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { JarShell, JarPanel } from '@/components/jar-exchange/jar-shell';
import { jarCodeStatusLabel } from '@/lib/jar-exchange/labels';
import { formatDateTime } from '@/lib/format';
export const dynamic = 'force-dynamic';
export default async function CodeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.jarCode.findUnique({ where: { id }, include: { redeemedByCustomer: true, issuedMerchant: true, returnedMerchant: true } });
  if (!row) notFound();
  const [audit, points, refill] = await Promise.all([
    prisma.statusAuditLog.findMany({ where: { entityType: 'jar_code', entityId: id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    prisma.memberPointsLedger.findMany({ where: { sourceType: 'jar_code_redeem', sourceRefId: id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    prisma.refillAuditLog.findMany({ where: { serial: row.code }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
  ]);
  return <JarShell pathname="/jar-exchange/manage" tab="codes" title={`序號 ${row.code}`} description="會員、店家與使用紀錄">
    <Link href="/jar-exchange/manage?tab=codes" className="text-sm underline">返回序號管理</Link>
    <JarPanel><dl className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
      {[
        ['狀態', jarCodeStatusLabel[row.status] ?? row.status], ['批次', row.batchNo ?? '—'],
        ['會員', row.redeemedByCustomer?.name ?? '—'], ['發放店家', row.issuedMerchant?.name ?? '—'],
        ['回收店家', row.returnedMerchant?.name ?? '—'], ['建立時間', formatDateTime(row.createdAt)],
        ['集點時間', row.redeemedAt ? formatDateTime(row.redeemedAt) : '—'], ['發放時間', row.issuedAt ? formatDateTime(row.issuedAt) : '—'],
        ['回收時間', row.returnedAt ? formatDateTime(row.returnedAt) : '—'], ['換罐占用', row.lockedByRefillOrderId ?? '—'],
      ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-all text-sm">{value}</dd></div>)}
    </dl></JarPanel>
    <JarPanel><div className="space-y-3 p-5"><h2 className="font-semibold">操作紀錄</h2>
      <p className="text-xs text-muted-foreground">既有集點與換罐紀錄保留原始來源；新版管理操作另記錄操作者。歷史缺失不補造紀錄。</p>
      {audit.map(event => <div key={event.id} className="rounded-xl border p-3 text-sm"><p>{formatDateTime(event.createdAt)} · {jarCodeStatusLabel[event.newStatus] ?? event.newStatus}</p><p className="break-all text-xs text-muted-foreground">操作者 {event.actorId ?? event.actorType} · {event.metadataJson}</p></div>)}
      {points.map(event => <div key={event.id} className="rounded-xl border p-3 text-sm">{formatDateTime(event.createdAt)} · 集點 {event.pointsChange} 點 · 餘額 {event.balanceAfter}</div>)}
      {refill.map(event => <div key={event.id} className="rounded-xl border p-3 text-sm">{formatDateTime(event.createdAt)} · {event.action} · {event.success ? '成功' : '失敗'}</div>)}
      {!audit.length && !points.length && !refill.length ? <p className="text-sm text-muted-foreground">尚無操作紀錄</p> : null}
    </div></JarPanel>
  </JarShell>;
}
