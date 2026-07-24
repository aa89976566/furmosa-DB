/**
 * 匠寵 LINE 三世界內容設定。
 * 新活動只加進 chaosItems，不必改 Rich Menu 架構。
 */

export type WorldHubId = 'jar' | 'chaos' | 'wild';

export type WorldMenuItem = {
  /** postback jd 值 */
  id: string;
  label: string;
  /** 未開戶時是否仍顯示（預設 true） */
  guestVisible?: boolean;
  /** URI 按鈕（野放中外連） */
  uri?: string;
};

export const WORLD_HUB_LABELS: Record<WorldHubId, string> = {
  jar: '換罐計畫',
  chaos: '一起搞事',
  wild: '野放中',
};

export const WORLD_HUB_EMOJI: Record<WorldHubId, string> = {
  jar: '♻️',
  chaos: '🔥',
  wild: '🌿',
};

export const JAR_EXPLAIN_TEXT = `【換罐計畫】很簡單

空罐不是垃圾，是毛孩的下一罐燃料。

① 先幫毛孩開戶（綁好美容合作店）
② 吃完零食，把罐底 8 碼傳上來
③ 點數進「毛孩罐庫」
④ 滿 10 點可換美容折價（豬窩 250、其他合作店 200）

沒開戶不能存罐。先認人，再記帳。`;

export const JAR_ENTER_HINT_REGISTERED =
  '把罐底那串 8 位數字直接傳上來就好。\n我們幫你記進毛孩罐庫。';

export const JAR_ENTER_BLOCKED_GUEST = '先幫毛孩開戶，就可以開始累積罐罐囉。';

export const CHAOS_INTRO =
  '這裡是匠寵正在搞的事。\n不是折扣區，是現場直播中的好玩東西。';

export const WILD_INTRO = '官網、社群、最新動態。\n想摸清楚匠寵在幹嘛，從這裡晃出去。';

/** 一起搞事：可無限往下加 */
export const CHAOS_ITEMS: WorldMenuItem[] = [
  { id: 'chaos_aowu', label: '嗷嗚計畫' },
  { id: 'chaos_frog', label: '清蛙誰在怕' },
  { id: 'chaos_month', label: '本月限定' },
  { id: 'chaos_bundle', label: '限定組合' },
  { id: 'chaos_recruit', label: '新品募集' },
  { id: 'chaos_guide', label: '拍攝指南' },
  { id: 'chaos_reward', label: '完成任務領 NT$100' },
];

export const CHAOS_COPY: Record<string, string> = {
  chaos_aowu: `【嗷嗚計畫】

拍真實吃貨現場，不當演員。

依拍攝指南完成素材，
審核通過可拿下次購物金 NT$100。

想參加就回：我要參加嗷嗚
並留下收件資料。`,

  chaos_frog: `【清蛙誰在怕】

青蛙凍乾實測場。
毛孩敢不敢碰、碰了什麼表情，拍下來。

依拍攝指南交件，
通過一樣拿下次購物金 NT$100。

回：我要參加清蛙`,

  chaos_month: `【本月限定】

這個月匠寵正在推的限定款，
細節會隨檔更新。

想搶先知道：去「野放中」追 IG。`,

  chaos_bundle: `【限定組合】

偶爾會組一些不講理但很爽的組合。
有開就會掛在這裡。`,

  chaos_recruit: `【新品募集】

想當第一批試吃的毛孩家長，留在這裡等召集。
有檔時會直接貼規則。`,

  chaos_guide: `【拍攝指南】

請拍這些就好（3–5 張或短影片）：

• 開箱瞬間
• 聞到味道的臉
• 正在吃的畫面
• 產品＋毛孩合照
• 日常一角（沙發、散步、窗邊都行）

IG 發文請標：
@furmosa_food
@furmosa_tw

講一句真心話，比長文有用。`,

  chaos_reward: `【完成任務領 NT$100】

依「拍攝指南」交件並套用指定標註，
審核通過後發給下次購物金 NT$100。

不是抽獎。做完、合格，再領。`,
};

export function buildJarHubItems(registered: boolean): WorldMenuItem[] {
  return [
    { id: 'jar_explain', label: '什麼是換罐' },
    { id: 'jar_reg', label: '幫毛孩開戶', guestVisible: true },
    {
      id: 'jar_enter',
      label: '輸入序號',
      guestVisible: true, // 訪客點了會被導去開戶
    },
    {
      id: 'jar_vault',
      label: '毛孩罐庫',
      guestVisible: true,
    },
  ].filter((item) => {
    if (registered) return true;
    // 未開戶仍顯示全部，但輸入序號／罐庫會導流開戶（避免死路）
    return item.guestVisible !== false;
  });
}
