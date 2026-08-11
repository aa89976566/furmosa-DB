import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { RefillExchangeWindowPreview } from '@/components/line-preview/refill-exchange-window-preview';

export const dynamic = 'force-dynamic';

/**
 * HQ 換購期限 Flex 視覺驗收（Phase 1）。
 * 認證：middleware HQ session（與 /admin/store-report 相同），未登入導向 /login。
 * 不呼叫 webhook、不發送 LINE、不讀寫 DB、不執行 Phase 2 enforcement。
 */
export default function RefillExchangeWindowPreviewPage() {
  return (
    <>
      <PageHeader
        title="換購期限 LINE 預覽"
        description="Phase 1 Preview — 加入前／啟用／錯店／即將到期／已過期。僅供 HQ 視覺驗收，尚未 live。"
      />
      <div className="p-4 sm:p-6">
        <Suspense fallback={<p className="text-sm text-muted-foreground">載入預覽…</p>}>
          <RefillExchangeWindowPreview />
        </Suspense>
      </div>
    </>
  );
}
