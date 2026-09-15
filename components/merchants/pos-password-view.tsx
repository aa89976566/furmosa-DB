'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { manageSavedPosPassword } from '@/app/(main)/merchants/[id]/pos-password-vault-action';

export function PosPasswordView({ merchantId, userId, username }: { merchantId: string; userId: string; username: string }) {
  const [password, setPassword] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(false);
  const generation = useRef(0);
  function hide() { generation.current++; setPassword(null); }
  useEffect(() => {
    const conceal = () => { if (document.hidden) { generation.current++; setPassword(null); } };
    document.addEventListener('visibilitychange', conceal);
    return () => { generation.current++; document.removeEventListener('visibilitychange', conceal); };
  }, []);
  useEffect(() => {
    if (!password) return;
    const timeout = setTimeout(hide, 30_000);
    return () => clearTimeout(timeout);
  }, [password]);

  async function run(currentPassword?: string) {
    hide(); setMessage(''); setPending(true);
    const request = generation.current;
    try {
      const result = await manageSavedPosPassword({ merchantId, userId, ...(currentPassword === undefined ? {} : { password: currentPassword }) });
      if (request !== generation.current) return;
      if (result.status === 'revealed') setPassword(result.password);
      if (result.status === 'missing') { setSaving(true); setMessage('尚未保存目前密碼，請先驗證並保存。'); }
      if (result.status === 'saved') { setSaving(false); setMessage('目前密碼已加密保存，可按「顯示密碼」查看。'); }
      if (result.status === 'error') setMessage(result.message);
    } catch { setMessage('暫時無法處理，請稍後再試。'); }
    finally { setPending(false); }
  }

  return (
    <section className="mt-2 space-y-2 rounded-lg border p-3" aria-label={`${username} 密碼保管`}>
      <p className="text-sm font-medium">{username} 的登入密碼</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => password ? hide() : void run()}>{pending ? '處理中…' : password ? '隱藏密碼' : '顯示密碼'}</Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => { hide(); setSaving(!saving); }}>保存目前密碼</Button>
      </div>
      {password && <><p className="select-text break-all rounded bg-muted p-3 font-mono" aria-label="已保存的 POS 密碼">{password}</p><p className="text-xs text-muted-foreground">30 秒後自動隱藏，切換分頁也會隱藏。</p></>}
      {saving && <form className="space-y-2" onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const current = String(new FormData(form).get('currentPassword') ?? '');
        form.reset(); void run(current);
      }}>
        <label className="block text-sm">目前 POS 密碼<Input name="currentPassword" type="password" autoComplete="off" minLength={8} maxLength={64} required disabled={pending} /></label>
        <Button size="sm" type="submit" disabled={pending}>驗證並保存</Button>
      </form>}
      {message && <p role="status" className="text-sm">{message}</p>}
    </section>
  );
}
