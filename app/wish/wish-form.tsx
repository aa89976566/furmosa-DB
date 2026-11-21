'use client';
import { useActionState } from 'react';
import { sendWish } from './actions';

export function WishForm({ token, species }: { token: string; species: string }) {
  const [state, action, pending] = useActionState(sendWish, { ok: false, message: '' });
  if (state.ok) return <p role="status" className="text-lg leading-relaxed">{state.message}</p>;
  const inputClass = 'mt-2 w-full rounded-2xl border-2 border-[#89ace0] bg-transparent px-4 py-3 text-base outline-offset-4';
  return <form action={action} className="space-y-6">
    <input type="hidden" name="token" value={token} />
    <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <label className="block text-lg font-semibold">幫哪位小夥伴找？
      <input className={inputClass} name="species" required maxLength={40} defaultValue={species} placeholder="例如：兔兔、天竺鼠、熟齡狗狗" />
    </label>
    <label className="block text-lg font-semibold">想找什麼？
      <textarea className={inputClass} name="requestText" required minLength={2} maxLength={500} rows={4} placeholder="告訴我們想找的東西、用途，或目前遇到的困擾。" />
    </label>
    <label className="block text-lg font-semibold">LINE ID
      <input className={inputClass} name="lineId" required minLength={4} maxLength={20} autoCapitalize="none" autoCorrect="off" spellCheck={false} pattern="[a-zA-Z0-9._\-]+" placeholder="填寫 ID，讓匠寵加你好友聯繫" />
      <span className="mt-2 block text-sm font-normal leading-relaxed">請填 LINE ID，非顯示名稱；僅用於聯繫這次許願，請確認可透過 ID 搜尋。</span>
    </label>
    {state.message && <p role="alert" className="text-base">{state.message}</p>}
    <button disabled={pending} className="w-full rounded-full bg-[#ffda62] px-6 py-4 text-lg font-bold disabled:opacity-60">{pending ? '送出中…' : '送出許願'}</button>
  </form>;
}
