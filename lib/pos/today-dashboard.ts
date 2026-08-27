/** 舊「今天」組裝已改為首頁待辦卡片。保留 re-export 避免舊測試路徑落空。 */
export {
  buildHomeTaskCards as buildTodayTaskRows,
  isInventoryReliable,
  type HomeTaskCard as TodayTaskRow,
  type HomeTasksInput as TodayDashboardInput,
} from '@/lib/pos/home-tasks';
