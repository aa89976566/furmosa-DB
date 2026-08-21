'use client';

import { useState } from 'react';
import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';
import { REFILL_INTRO, REFILL_TITLE } from '@/lib/merchant-pos-preview/copy';
import { parsePreviewOldJarSerial } from '@/lib/merchant-pos-preview/validators';
import { PreviewAction } from './preview-action';
import { PREVIEW_ACTION_TONES } from './preview-action-matrix';
import { PreviewDialog } from './preview-dialog';

const DEMO_OLD_JAR_SERIAL = '12345678';

export function RefillPanel() {
  const [open, setOpen] = useState(false);
  const [oldSerial, setOldSerial] = useState('');
  const [verified, setVerified] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function verifyOldJar() {
    const parsed = parsePreviewOldJarSerial(oldSerial);
    if (!parsed.ok) {
      setError(parsed.error);
      setVerified(false);
      return;
    }
    if (parsed.value !== DEMO_OLD_JAR_SERIAL) {
      setError('這個序號不屬於此示意訂單');
      setVerified(false);
      return;
    }
    setOldSerial(parsed.value);
    setVerified(true);
    setError(null);
  }

  return (
    <section aria-labelledby="refill-title" className="min-w-0 space-y-6">
      <div className={styles.pageHeader}>
        <h2 id="refill-title" className={styles.sectionTitle}>{REFILL_TITLE}</h2>
        <p className={styles.sectionIntro}>{REFILL_INTRO}</p>
      </div>

      <ul className={styles.recordList}>
        <li className={styles.recordListItem}>
          <button type="button" className={styles.recordRowButton} onClick={() => setOpen(true)}>
            <span className={styles.recordMain}>
              <strong>REFILL-DEMO-001</strong>
              <span>示意會員 · 雞肉凍乾 1 罐</span>
            </span>
            <span className={styles.recordSummary}>
              <strong>{completed ? '已交付（預覽）' : '已付款'}</strong>
              <span>{completed ? '流程完成' : '已保留門市庫存'}</span>
            </span>
            <span className={styles.recordChevron} aria-hidden="true">›</span>
          </button>
        </li>
        <li className={styles.recordListItem}>
          <div className={styles.recordStaticRow}>
            <span className={styles.recordMain}>
              <strong>REFILL-DEMO-002</strong>
              <span>示意會員 · 原味牛肉條 1 罐</span>
            </span>
            <span className={styles.recordSummary}>
              <strong>等待付款</strong>
              <span>不可驗罐或交付</span>
            </span>
          </div>
        </li>
      </ul>

      <PreviewDialog open={open} titleId="refill-order-title" title="換罐交付" presentation="drawer" onClose={() => setOpen(false)}>
        <div className={styles.drawerBody}>
          <dl className={styles.defList}>
            <div className={styles.defRow}><dt>訂單</dt><dd>REFILL-DEMO-001</dd></div>
            <div className={styles.defRow}><dt>付款狀態</dt><dd>已付款</dd></div>
            <div className={styles.defRow}><dt>庫存</dt><dd>測試門市已保留 1 罐</dd></div>
            <div className={styles.defRow}><dt>需收回</dt><dd>舊罐 1 個</dd></div>
          </dl>

          {!verified && !completed ? (
            <>
              <div>
                <label className={styles.fieldLabel} htmlFor="preview-old-jar-serial">舊罐瓶底序號</label>
                <input
                  id="preview-old-jar-serial"
                  className={styles.field}
                  inputMode="numeric"
                  maxLength={8}
                  value={oldSerial}
                  onChange={(event) => {
                    setOldSerial(event.target.value.replace(/\D/g, '').slice(0, 8));
                    setError(null);
                    setVerified(false);
                  }}
                  placeholder="8 位數字"
                  aria-describedby={error ? 'old-jar-error' : 'old-jar-hint'}
                />
                <p id="old-jar-hint" className={styles.fieldHint}>示意有效序號：{DEMO_OLD_JAR_SERIAL}</p>
              </div>
              <PreviewAction tone={PREVIEW_ACTION_TONES.verifyOldJar} className={styles.actionBlock} onClick={verifyOldJar}>
                驗證舊罐序號
              </PreviewAction>
            </>
          ) : null}

          {verified && !completed ? (
            <>
              <p className={styles.notice} role="status">舊罐序號驗證通過</p>
              <PreviewAction tone={PREVIEW_ACTION_TONES.completeRefill} className={styles.actionBlock} onClick={() => setCompleted(true)}>
                確認收到空罐並交付商品（預覽）
              </PreviewAction>
            </>
          ) : null}

          {completed ? <p className={styles.notice} role="status">換罐交付已完成預覽；沒有扣除正式庫存或增加點數。</p> : null}
          {error ? <p id="old-jar-error" className={styles.errorText} role="alert">{error}</p> : null}
          <p className={styles.quietNote}>門市只驗證舊罐；新罐由會員領取後在 LINE 登錄。</p>
          <PreviewAction tone={PREVIEW_ACTION_TONES.refundCancel} className={styles.actionBlock} onClick={() => setOpen(false)}>
            返回
          </PreviewAction>
        </div>
      </PreviewDialog>
    </section>
  );
}
