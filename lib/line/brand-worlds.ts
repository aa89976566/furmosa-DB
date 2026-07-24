/**
 * 匠寵 LINE 三世界資訊架構。
 *
 * Rich Menu 只有三格：換罐計畫／一起搞事／野放中
 * 細項全部進 Flex；制度與活動嚴格切開。
 */

export type WorldHubId = 'jar' | 'chaos' | 'wild';

export type WorldMenuItem = {
  id: string;
  label: string;
  uri?: string;
};

export const WORLD_HUB_LABELS: Record<WorldHubId, string> = {
  jar: '換罐計畫',
  chaos: '一起搞事',
  wild: '野放中',
};

/** Rich Menu／Flex 標題 emoji（一起搞事用慶祝，不是火焰促銷感） */
export const WORLD_HUB_EMOJI: Record<WorldHubId, string> = {
  jar: '♻️',
  chaos: '🎉',
  wild: '🌿',
};

export const JAR_ENTER_HINT_REGISTERED =
  '把罐底那串 8 位數字直接傳上來就好。\n我們幫你記進毛孩罐庫。';

/** 未開戶擋序號：只這句＋立即開戶，不塞其他功能 */
export const JAR_ENTER_BLOCKED_GUEST = `先幫毛孩開戶
完成後就能開始累積罐罐。`;

export const CHAOS_INTRO = '這裡只有匠寵正在搞的事。\n制度相關請走「換罐計畫」。';

export const WILD_INTRO = '官網、社群、店家、故事。\n想晃進匠寵世界，從這裡出去。';

/** 什麼是換罐：介紹 → 流程 → 合作店家 → FAQ */
export const JAR_EXPLAIN_INTRO = `【什麼是換罐】

空罐不是垃圾。
吃完零食，把罐底 8 碼傳給我們，點數進毛孩罐庫。

滿 10 點可換美容折價：
豬窩 250 元／其他合作店 200 元。

這是會員制度，不是活動抽獎。`;

export const JAR_EXPLAIN_FLOW = `【怎麼玩】

① 幫毛孩開戶（綁一間美容合作店）
② 吃完零食
③ 傳罐底 8 碼
④ 點數進「毛孩罐庫」
⑤ 滿點換折價，到綁定店家用

沒開戶不能存罐。先認人，再記帳。`;

export const JAR_EXPLAIN_FAQ = `【常見問題】

Q：一定要開戶嗎？
A：要。沒開戶序號進不了罐庫。

Q：一個 LINE 能綁幾隻毛孩？
A：目前一戶一檔；多毛孩先寫進備註或跟我們說。

Q：換了店怎麼辦？
A：開戶店永久綁定折價使用店。要改請跟我們說。

Q：序號打錯？
A：再傳一次對的 8 碼；已用過的不能重複。

Q：點數會過期嗎？
A：點數本身不過期；折價券兌換後有使用期限（30 天）。`;

export const BRAND_STORY = `【品牌故事】

匠寵 Furmosa。
零食要手作質感，空罐也要有去處。

我們不愛講很公司的話。
比較像：認真做給毛孩吃的東西，
順便把循環玩成一件日常小事。`;

/** 一起搞事：只有活動；可無限擴充 */
export const CHAOS_ITEMS: WorldMenuItem[] = [
  { id: 'chaos_aowu', label: '🐶 嗷嗚計畫' },
  { id: 'chaos_frog', label: '🐸 清蛙誰在怕' },
  { id: 'chaos_guide', label: '🎬 拍攝指南' },
  { id: 'chaos_reward', label: '🎁 完成拿100元' },
  { id: 'chaos_month', label: '✨ 本月限定' },
  { id: 'chaos_bundle', label: '🎉 限定組合' },
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

  chaos_reward: `【完成拿 100 元】

依「拍攝指南」交件並套用指定標註，
審核通過後發給下次購物金 NT$100。

不是抽獎。做完、合格，再領。`,

  chaos_month: `【本月限定】

這個月匠寵正在推的限定款，
細節會隨檔更新。

想搶先知道：去「野放中」追 IG。`,

  chaos_bundle: `【限定組合】

偶爾會組一些不講理但很爽的組合。
有開就會掛在這裡。`,
};

/**
 * 換罐計畫 Flex：依是否開戶變形。
 * 未開戶不出現「輸入序號／罐庫」等不能用的功能。
 */
export function buildJarHubItems(registered: boolean): {
  items: WorldMenuItem[];
  primaryId: string;
  body: string;
} {
  if (registered) {
    return {
      primaryId: 'jar_enter',
      body: '每天最常用的都在這。先傳序號，或看罐庫。',
      items: [
        { id: 'jar_enter', label: '① 輸入序號' },
        { id: 'jar_vault', label: '② 毛孩罐庫' },
        { id: 'jar_history', label: '③ 換罐紀錄' },
        { id: 'jar_explain', label: '④ 什麼是換罐' },
      ],
    };
  }

  return {
    primaryId: 'jar_reg',
    body: '第一次來？先搞懂換罐，再幫毛孩開戶。',
    items: [
      { id: 'jar_explain', label: '① 什麼是換罐 ⭐' },
      { id: 'jar_reg', label: '② 幫毛孩開戶' },
      { id: 'jar_stores', label: '③ 合作店家' },
      { id: 'jar_faq', label: '④ 常見問題' },
    ],
  };
}

/** @deprecated 說明已拆成 intro／flow／faq */
export const JAR_EXPLAIN_TEXT = JAR_EXPLAIN_INTRO;
