'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { CANDIDATE_BLOCK_REASONS } from '@/lib/shopify/catalog-candidate-shared';
import {
  blockCandidateAction,
  createCandidateAction,
  linkCandidateAction,
  type CandidateActionState,
} from '../actions';
import { TIER_UNIT_PRESETS } from '@/lib/product-units';

const initialState: CandidateActionState = { ok: false, message: '' };

function SubmitButton({ children, pendingText, variant = 'default' }: {
  children: React.ReactNode;
  pendingText: string;
  variant?: 'default' | 'outline';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant} className="min-h-11">
      {pending ? pendingText : children}
    </Button>
  );
}

function ActionError({ state }: { state: CandidateActionState }) {
  return state.message ? (
    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {state.message}
    </p>
  ) : null;
}

export function LinkCandidateForm(props: {
  candidateId: string;
  tierId: string;
  fingerprint: string;
  tierLabel: string;
}) {
  const [state, action] = useActionState(linkCandidateAction, initialState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="candidateId" value={props.candidateId} />
      <input type="hidden" name="tierId" value={props.tierId} />
      <input type="hidden" name="expectedFingerprint" value={props.fingerprint} />
      <ActionError state={state} />
      <SubmitButton pendingText="確認中…">確認連結「{props.tierLabel}」</SubmitButton>
    </form>
  );
}

export function BlockCandidateForm(props: { candidateId: string; fingerprint: string }) {
  const [state, action] = useActionState(blockCandidateAction, initialState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="candidateId" value={props.candidateId} />
      <input type="hidden" name="expectedFingerprint" value={props.fingerprint} />
      <label className="block space-y-1 text-sm font-medium">
        <span>這次不建立的原因</span>
        <select name="reason" required defaultValue="" className="min-h-11 w-full rounded-lg border border-border bg-background px-3">
          <option value="" disabled>請選擇原因</option>
          {CANDIDATE_BLOCK_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
        </select>
      </label>
      <label className="block space-y-1 text-sm font-medium">
        <span>補充說明</span>
        <textarea
          name="note"
          maxLength={500}
          rows={2}
          placeholder="選擇「其他」時必填"
          className="w-full rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        不會刪除 Shopify 商品；未對應訂單仍會保持阻擋，不會自動出貨或扣庫存。
      </p>
      <ActionError state={state} />
      <SubmitButton pendingText="處理中…" variant="outline">確認這次不建立</SubmitButton>
    </form>
  );
}

export function CreateCandidateForm(props: {
  candidateId: string;
  fingerprint: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  price: number;
  existingProductName?: string | null;
  targetProductId?: string | null;
  prefillCategory?: string;
  prefillWeightGrams?: number;
  prefillCost?: number;
}) {
  const [state, action] = useActionState(createCandidateAction, initialState);
  const [mode, setMode] = useState<'weight' | 'unit'>('weight');
  const initialCategory = props.prefillCategory ?? '';
  const initialWeight = props.prefillWeightGrams == null ? '' : String(props.prefillWeightGrams);
  const initialCost = props.prefillCost == null ? '' : String(props.prefillCost);
  const [categoryEdited, setCategoryEdited] = useState(false);
  const [weightEdited, setWeightEdited] = useState(false);
  const [costEdited, setCostEdited] = useState(false);
  const isExisting = Boolean(props.existingProductName);
  return (
    <form
      action={action}
      className="space-y-4"
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        const specification = mode === 'weight'
          ? `${data.get('weightGrams')} g`
          : `${data.get('unitQty')} ${data.get('unit')}`;
        const summary = [
          `確認${isExisting ? `新增規格到「${props.existingProductName}」` : '建立新商品與規格'}？`,
          `商品：${props.productTitle}`,
          `規格：${specification}`,
          `SKU：${props.sku}`,
          `售價：NT$${props.price}`,
          `整包進貨成本：NT$${data.get('cost')}`,
          '庫存：0（尚未入庫）',
          'Shopify：不修改',
          '未對應訂單：不會自動解除阻擋',
        ].join('\n');
        if (!window.confirm(summary)) event.preventDefault();
      }}
    >
      <input type="hidden" name="candidateId" value={props.candidateId} />
      <input type="hidden" name="expectedFingerprint" value={props.fingerprint} />
      {props.targetProductId ? <input type="hidden" name="targetProductId" value={props.targetProductId} /> : null}
      <input type="hidden" name="mode" value={mode} />
      <div className="rounded-xl bg-muted/50 p-3 text-sm">
        <p className="font-medium">{props.productTitle}｜{props.variantTitle || '預設規格'}</p>
        <p className="mt-1 text-muted-foreground">SKU {props.sku} · 售價 NT${props.price.toLocaleString('zh-TW')}</p>
        {isExisting ? <p className="mt-2 font-medium text-emerald-900">依唯一相同商品名，將新增到：{props.existingProductName}</p> : null}
      </div>
      {!isExisting ? (
        <label className="block space-y-1 text-sm font-medium">
          <span>HQ 商品分類</span>
          <select name="category" required defaultValue={initialCategory} onChange={() => setCategoryEdited(true)} className="min-h-11 w-full rounded-lg border border-border bg-background px-3">
            <option value="" disabled>請選擇分類</option>
            <option value="staple_food">主食</option><option value="treats">零食</option><option value="health">保健</option>
            <option value="freeze_dried">凍乾</option><option value="toys">玩具</option><option value="accessories">用品</option><option value="other">其他</option>
          </select>
          {initialCategory && !categoryEdited ? <span className="block text-xs font-normal text-amber-800">舊表帶入，送出前請確認</span> : null}
        </label>
      ) : <input type="hidden" name="category" value="other" />}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">實際包裝規格</legend>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant={mode === 'weight' ? 'default' : 'outline'} onClick={() => setMode('weight')}>按重量</Button>
          <Button type="button" variant={mode === 'unit' ? 'default' : 'outline'} onClick={() => setMode('unit')}>按數量</Button>
        </div>
        {mode === 'weight' ? (
          <label className="block space-y-1 text-sm">
            <span>每包淨重（g）</span>
            <input name="weightGrams" type="number" min="1" step="1" required defaultValue={initialWeight} onChange={() => setWeightEdited(true)} className="min-h-11 w-full rounded-lg border px-3" placeholder="依包裝標示填寫，不要從名稱猜" />
            {initialWeight && !weightEdited ? <span className="block text-xs text-amber-800">由 Shopify 規格解析，送出前請確認</span> : null}
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-sm"><span>每包數量</span><input name="unitQty" type="number" min="1" step="1" required className="min-h-11 w-full rounded-lg border px-3" /></label>
            <label className="space-y-1 text-sm"><span>單位</span><select name="unit" required className="min-h-11 w-full rounded-lg border bg-background px-3">{TIER_UNIT_PRESETS.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
          </div>
        )}
      </fieldset>
      <label className="block space-y-1 text-sm font-medium">
        <span>這個規格整包進貨成本（NT$）</span>
        <input name="cost" type="number" min="0.01" step="0.01" required defaultValue={initialCost} onChange={() => setCostEdited(true)} className="min-h-11 w-full rounded-lg border px-3" />
        {initialCost && !costEdited ? <span className="block text-xs font-normal text-amber-800">舊表帶入，送出前請確認</span> : null}
        <span className="block text-xs font-normal text-muted-foreground">填供應商向我們收的單包成本，不是 Shopify 售價。</span>
      </label>
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
        只建立商品資料；庫存維持 0，收到貨後另走採購入庫或盤點。Shopify 與訂單狀態不會自動修改。
      </div>
      <ActionError state={state} />
      <SubmitButton pendingText="建立中…">{isExisting ? '新增這個規格' : '建立商品與這個規格'}</SubmitButton>
    </form>
  );
}
