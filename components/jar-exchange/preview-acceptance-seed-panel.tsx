import { PreviewReadonlyNotice } from '@/components/jar-exchange/preview-readonly-notice';

/** 舊驗收寫入面板已改成只讀說明，避免 Preview 誤寫正式庫。 */
export function PreviewAcceptanceSeedPanel() {
  return <PreviewReadonlyNotice />;
}
