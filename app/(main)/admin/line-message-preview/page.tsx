import { PageHeader } from '@/components/shared/page-header';
import { JibaUnboxPreview } from '@/components/line-preview/jiba-unbox-preview';

export const dynamic = 'force-dynamic';

/**
 * HQ 桌機 LINE 訊息預覽（雞霸開箱）。
 * 認證：走 middleware HQ session（與 /admin/store-report 相同），未登入導向 /login。
 * 本頁不呼叫 webhook、不發送 LINE、不讀寫 DB。
 */
export default function LineMessagePreviewPage() {
  return (
    <>
      <PageHeader
        title="LINE 訊息預覽"
        description="雞霸開箱（jiba-unbox）桌機模擬器 — 僅供 HQ 對照文案與 Flex 結構，不會傳送真實訊息。"
      />
      <div className="p-4 sm:p-6">
        <JibaUnboxPreview />
      </div>
    </>
  );
}
