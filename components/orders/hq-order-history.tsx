import { prisma } from '@/lib/prisma';
import { record } from '@/lib/shopify/intake-policy';

export async function HqOrderHistory({ orderId }: { orderId: string }) {
  const history = await prisma.statusAuditLog.findMany({ where: { entityType: { in: ['hq_order_adjustment', 'oms_review', 'order_deletion'] }, entityId: orderId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 30 });
  const actors = await prisma.user.findMany({ where: { id: { in: history.map(entry => entry.actorId).filter((id): id is string => Boolean(id)) } }, select: { id: true, name: true } });
  return (<details className="rounded-xl border bg-background p-4"><summary className="cursor-pointer font-semibold">操作紀錄</summary><ol className="mt-3 space-y-3">{history.map(entry => {
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(entry.metadataJson ?? '{}'); } catch { /* Show audit identity even if legacy metadata is malformed. */ }
      return <li key={entry.id} className="rounded-lg border p-3 text-sm"><p className="font-semibold">{entry.entityType === 'hq_order_adjustment' ? '修改 HQ 訂單' : entry.entityType === 'order_deletion' ? '刪除／還原訂單' : '儲存並重新檢查'} · {actors.find(actor => actor.id === entry.actorId)?.name ?? entry.actorId ?? '系統'}</p><p>{entry.createdAt.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</p>{typeof data.reason === 'string' ? <p>原因：{data.reason}</p> : null}{entry.entityType === 'hq_order_adjustment' ? <details className="mt-2"><summary className="cursor-pointer">修改前後內容</summary><div className="grid gap-3 pt-2 sm:grid-cols-2">{['before', 'after'].map(key => {
        const value = record(data[key]);
        const lines = Array.isArray(value.lines) ? value.lines.map(record) : [];
        return <div key={key}><p className="font-medium">{key === 'before' ? '修改前' : '修改後'}</p><ul>{lines.map((line, index) => <li key={index}>{String(line.title ?? '')} ×{String(line.quantity ?? '')} · 單價 {String(line.price ?? '')}</li>)}</ul><p>運費 {String(value.shippingFee ?? '待確認')} · 總額 {String(value.total ?? '待確認')}</p></div>;
      })}</div></details> : null}</li>;
    })}</ol></details>);
}
