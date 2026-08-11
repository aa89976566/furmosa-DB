/**
 * Brief-first CONSENSUS：模式 brief＋CONFIRM 後 first content（單一事實來源）
 * - 新流程 session step 寫入 `brief`（= MODE_BRIEF_SHOWN）
 * - `sample`（= MODE_SAMPLE）僅 legacy read-only；不得再寫入
 * - NEWS first content＝#103 已核對之歷史示範；不稱今日新聞、不進每日庫
 */

export const ONBOARDING_MODE_ACTION_IDS = ['content_a', 'content_b'] as const;
export type OnboardingModeActionId = (typeof ONBOARDING_MODE_ACTION_IDS)[number];

/** 入口二選一 label（exact） */
export const ONBOARDING_MODE_LABELS: Record<OnboardingModeActionId, string> = {
  content_a: '笑個毛',
  content_b: '豎起耳朵',
};

/** MODE_BRIEF_SHOWN：一句 brief（exact；LINE／Preview 共用） */
export const HUMOR_MODE_BRIEF =
  '毛孩笑話，加上一點只有飼主才懂的荒謬日常。';

export const NEWS_MODE_BRIEF =
  '台灣優先，也會聽聽全球毛孩圈的消息。只帶來源可靠的回來，沒有就不硬湊。';

export const BRIEF_BUTTON_LABELS = {
  confirm: '確認此模式',
  switch: '看看另一個',
  pass: '先不用',
} as const;

export type BriefButtonId =
  | 'brief_confirm'
  | 'brief_switch'
  | 'brief_pass';

export type BriefButtonDef = {
  actionId: BriefButtonId;
  label: string;
};

/**
 * Legacy MODE_SAMPLE bodies（read-only／回歸用）
 * 新流程 CONFIRM 前禁止顯示；不得再寫入 session step=`sample`
 */
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

/** CONFIRM winner 後第一則內容（exact） */
export const HUMOR_FIRST_CONTENT = [
  '先來一則，算我今天有上工：',
  '',
  '散步結束，我跟狗說：「回家了。」',
  '牠立刻躺在地上。',
  '',
  '平常叫不動是一回事，',
  '直接變成不動產又是另一回事。',
].join('\n');

/** 豎起耳朵 first content＝#103 已核對 static historical sample */
export const NEWS_FIRST_CONTENT = NEWS_SAMPLE_BODY;

/** @deprecated legacy sample button ids（allowlist 保留；不得用於新寫入） */
export type SampleButtonId =
  | 'sample_confirm'
  | 'sample_switch'
  | 'sample_pass';

export type SampleButtonDef = {
  actionId: SampleButtonId;
  label: string;
};

export function getModeBrief(modeActionId: OnboardingModeActionId): string {
  return modeActionId === 'content_a' ? HUMOR_MODE_BRIEF : NEWS_MODE_BRIEF;
}

export function renderModeBriefMessage(
  pendingMode: OnboardingModeActionId,
): string {
  return getModeBrief(pendingMode);
}

export function getBriefButtons(): readonly BriefButtonDef[] {
  return [
    { actionId: 'brief_confirm', label: BRIEF_BUTTON_LABELS.confirm },
    { actionId: 'brief_switch', label: BRIEF_BUTTON_LABELS.switch },
    { actionId: 'brief_pass', label: BRIEF_BUTTON_LABELS.pass },
  ] as const;
}

export function getFirstContent(modeActionId: OnboardingModeActionId): string {
  return modeActionId === 'content_a'
    ? HUMOR_FIRST_CONTENT
    : NEWS_FIRST_CONTENT;
}

/** @deprecated legacy read-only */
export function getSampleBody(modeActionId: OnboardingModeActionId): string {
  return modeActionId === 'content_a' ? HUMOR_SAMPLE_BODY : NEWS_SAMPLE_BODY;
}

/** @deprecated legacy read-only */
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

/** @deprecated legacy read-only */
export function renderSampleMessage(
  pendingMode: OnboardingModeActionId,
): string {
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
