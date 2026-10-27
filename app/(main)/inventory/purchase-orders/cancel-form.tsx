'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cancelPendingOrder } from './actions';

export function CancelPurchaseOrderForm({ id }: { id: string }) {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  return <form className="space-y-3 rounded-xl border p-5" onSubmit={async event => {
    event.preventDefault();
    if (busy.current || done) return;
    const data = new FormData(event.currentTarget);
    if (!window.confirm('作廢這張未收貨採購單？原單與原因會保留，庫存與成本不會變更。')) return;
    busy.current = true; setPending(true); setError('');
    try {
      const result = await cancelPendingOrder(id, String(data.get('reason') ?? ''));
      if (!result.ok) setError(result.message);
      else { setDone(true); try { router.refresh(); } catch { /* Committed result remains successful. */ } }
    } catch { setError('作廢結果尚未確認，請重新載入原單核對狀態後再操作。'); }
    finally { busy.current = false; setPending(false); }
  }}>
    <h2 className="font-semibold">作廢未收貨採購單</h2>
    <p className="text-sm text-muted-foreground">適用於重複或取消的採購；保留原單，庫存與成本不變。</p>
    <label className="block text-sm">作廢原因<textarea name="reason" required maxLength={500} disabled={pending || done} className="mt-1 block min-h-24 w-full rounded-md border bg-background p-3" /></label>
    <Button type="submit" variant="outline" disabled={pending || done}>{done ? '已作廢' : pending ? '處理中…' : '作廢這張採購單'}</Button>
    {done ? <p role="status">採購單已作廢，庫存與成本沒有變更。</p> : null}
    <Dialog open={Boolean(error)} onOpenChange={open => { if (!open) setError(''); }}><DialogContent><DialogHeader><DialogTitle>無法完成作廢</DialogTitle><DialogDescription>{error}</DialogDescription></DialogHeader><Button type="button" onClick={() => setError('')}>返回檢查</Button></DialogContent></Dialog>
  </form>;
}
