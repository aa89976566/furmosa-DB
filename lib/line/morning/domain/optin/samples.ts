/**
 * Sample-first CONSENSUS：固定示範文案（單一事實來源）
 * NEWS sample＝歷史示範，不稱今日新聞、不進每日內容庫、不改抓取器。
 */

export const ONBOARDING_MODE_ACTION_IDS = ['content_a', 'content_b'] as const;
export type OnboardingModeActionId = (typeof ONBOARDING_MODE_ACTION_IDS)[number];

/** 入口二選一 label（exact） */
export const ONBOARDING_MODE_LABELS: Record<OnboardingModeActionId, string> = {
  content_a: '笑個毛',
  content_b: '豎起耳朵',
};

export const HUMOR_SAMPLE_BODY = [
  '早。今天出門前問狗狗：「要不要上班？」',
  '牠立刻把牽繩叼來。',
  '看來牠以為我的工作，是陪牠去公園。',
].join('\n');

export const NEWS_SAMPLE_BODY = [
  '先豎起耳朵，試聽一則台灣毛孩消息：',
  '新北市河濱設有 7 座寵物公園，這些空間從 2009 年起陸續設置，2023 年也全面增設洗腳池，讓毛孩放風後可以清潔再回家。',
  '壽司匠一句：公園可以放風，禮貌不能一起放掉。',
  '來源：新北市政府，〈新北河濱 7座寵物公園 陪你和毛孩歡度「國際狗狗日」〉（發布日期 2025-08-26；內容介紹既有設施，並非 2025 年新建）',
  'https://www.ntpc.gov.tw/ch/home.jsp?dataserno=579176ca4ae665a9a8553ccf68864cb8&id=e8ca970cde5c00e1',
].join('\n');

/** 來源逐句核對（交付／測試用；對應原文要點） */
export const NEWS_SAMPLE_SOURCE_FACTS = [
  '7 座',
  '2009 年起陸續設置',
  '2023 年',
  '洗腳池',
] as const;

export const NEWS_SAMPLE_SOURCE_URL =
  'https://www.ntpc.gov.tw/ch/home.jsp?dataserno=579176ca4ae665a9a8553ccf68864cb8&id=e8ca970cde5c00e1';

export type SampleButtonId =
  | 'sample_confirm'
  | 'sample_switch'
  | 'sample_pass';

export type SampleButtonDef = {
  actionId: SampleButtonId;
  label: string;
};

export function getSampleBody(modeActionId: OnboardingModeActionId): string {
  return modeActionId === 'content_a' ? HUMOR_SAMPLE_BODY : NEWS_SAMPLE_BODY;
}

export function getSampleButtons(
  pendingMode: OnboardingModeActionId,
): readonly SampleButtonDef[] {
  if (pendingMode === 'content_a') {
    return [
      { actionId: 'sample_confirm', label: '好，就笑個毛' },
      { actionId: 'sample_switch', label: '換成豎起耳朵' },
      { actionId: 'sample_pass', label: '先不用' },
    ] as const;
  }
  return [
    { actionId: 'sample_confirm', label: '好，我豎起耳朵' },
    { actionId: 'sample_switch', label: '換成笑個毛' },
    { actionId: 'sample_pass', label: '先不用' },
  ] as const;
}

export function renderSampleMessage(pendingMode: OnboardingModeActionId): string {
  return getSampleBody(pendingMode);
}

export function otherOnboardingMode(
  mode: OnboardingModeActionId,
): OnboardingModeActionId {
  return mode === 'content_a' ? 'content_b' : 'content_a';
}

export function isOnboardingModeActionId(
  v: string,
): v is OnboardingModeActionId {
  return (ONBOARDING_MODE_ACTION_IDS as readonly string[]).includes(v);
}
