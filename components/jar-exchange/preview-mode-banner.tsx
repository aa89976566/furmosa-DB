export const PREVIEW_MODE_LABEL = '預覽模式｜不會儲存變更';

export function PreviewModeBanner() {
  return (
    <div className="mb-6 rounded-2xl border border-border/60 bg-card px-5 py-4">
      <p className="text-sm font-medium text-navy">{PREVIEW_MODE_LABEL}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        這一頁只讀正式店家資料，用來核對清單。確認、撤銷、新增、開通、修改、刪除都已停用，按了也不會寫進資料庫。
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        登入、開頁、重整，或在手機與桌機之間切換，都不會產生新資料。
      </p>
    </div>
  );
}
