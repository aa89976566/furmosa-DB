'use client';

import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';
import {
  CART_ESCAPE_HINT,
  CART_TITLE,
  COMPLETE_SALE_CANCEL,
  COMPLETE_SALE_CONFIRM,
  COMPLETE_SALE_CONFIRM_BODY,
  COMPLETE_SALE_CONFIRM_TITLE,
} from '@/lib/merchant-pos-preview/copy';
import type { MerchantPosSession } from '@/lib/merchant-pos-preview/types';
import { CartWorkspace } from './cart-workspace';
import { PreviewAction } from './preview-action';
import { PREVIEW_ACTION_TONES } from './preview-action-matrix';
import { PreviewDialog } from './preview-dialog';

export function CartSheet({
  session,
  showEditor,
  onClose,
  onQty,
  onQtyInput,
  onQtyCommit,
  onRemove,
  onPrice,
  onAskComplete,
  onCancelComplete,
  onComplete,
}: {
  session: MerchantPosSession;
  showEditor: boolean;
  onClose: () => void;
  onQty: (skuId: string, delta: number) => void;
  onQtyInput: (skuId: string, value: string) => void;
  onQtyCommit: (skuId: string) => void;
  onRemove: (skuId: string) => void;
  onPrice: (skuId: string, value: string) => void;
  onAskComplete: () => void;
  onCancelComplete: () => void;
  onComplete: () => void;
}) {
  const confirming = session.cartDialogStep === 'confirm';
  const open = session.cartOpen && (confirming || showEditor);

  return (
    <PreviewDialog
      open={open}
      titleId={confirming ? 'complete-sale-title' : 'cart-title'}
      title={confirming ? COMPLETE_SALE_CONFIRM_TITLE : CART_TITLE}
      onClose={confirming ? onCancelComplete : onClose}
    >
      {confirming ? (
        <div className="space-y-4">
          <p className={styles.hint}>{COMPLETE_SALE_CONFIRM_BODY}</p>
          <p className={styles.quietNote}>{CART_ESCAPE_HINT}</p>
          <div className={styles.stack}>
            <PreviewAction
              tone={PREVIEW_ACTION_TONES.completeSaleConfirm}
              className={`${styles.actionBlock} min-h-[44px]`}
              onClick={onComplete}
            >
              {COMPLETE_SALE_CONFIRM}
            </PreviewAction>
            <PreviewAction
              tone={PREVIEW_ACTION_TONES.completeSaleCancel}
              className={`${styles.actionBlock} min-h-[44px]`}
              onClick={onCancelComplete}
            >
              {COMPLETE_SALE_CANCEL}
            </PreviewAction>
          </div>
        </div>
      ) : showEditor ? (
        <CartWorkspace
          session={session}
          onQty={onQty}
          onQtyInput={onQtyInput}
          onQtyCommit={onQtyCommit}
          onRemove={onRemove}
          onPrice={onPrice}
          onAskComplete={onAskComplete}
        />
      ) : null}
    </PreviewDialog>
  );
}
