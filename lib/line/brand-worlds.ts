/**
 * 匠寵 LINE 三世界資訊架構 + 卡片文案。
 * Rich Menu 只有三張大卡入口；細項皆為卡片，非灰底按鈕列。
 */

export type WorldHubId = 'jar' | 'chaos' | 'wild';

export type WorldMenuItem = {
  id: string;
  /** 卡片主標（可含 emoji／記號） */
  label: string;
  /** 大記號／插畫替代（卡片頂部） */
  mark: string;
  /** 一行副標 */
  subtitle: string;
  /** public/line/cards/{heroKey}.png */
  heroKey: string;
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

export const WORLD_HUB_TAGLINE: Record<WorldHubId, string> = {
  jar: '一罐一罐累積。',
  chaos: '最近又有什麼新鮮事。',
  wild: '看看匠寵最近跑去哪。',
};

export const JAR_ENTER_HINT_REGISTERED =
  '把罐底那串 8 位數字直接傳上來就好。\n我們幫你記進毛孩罐庫。';

export const JAR_ENTER_BLOCKED_GUEST = `先幫毛孩開戶
完成後就能開始累積罐罐。`;

export const CHAOS_INTRO = '便利貼牆。正在搞的事都釘在這。';

export const WILD_INTRO = '地圖攤開。官網、社群、店家、故事。';

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

/** 一起搞事：佈告欄便利貼 */
export const CHAOS_ITEMS: WorldMenuItem[] = [
  {
    id: 'chaos_aowu',
    mark: '📌',
    label: '嗷嗚計畫',
    subtitle: '真實吃貨現場，不當演員。',
    heroKey: 'chaos-aowu',
  },
  {
    id: 'chaos_frog',
    mark: '🐸',
    label: '清蛙誰在怕',
    subtitle: '青蛙凍乾實測場。',
    heroKey: 'chaos-frog',
  },
  {
    id: 'chaos_guide',
    mark: '🎬',
    label: '拍攝指南',
    subtitle: '拍這些就好，別演。',
    heroKey: 'chaos-guide',
  },
  {
    id: 'chaos_reward',
    mark: '🎁',
    label: '完成拿100',
    subtitle: '合格再領下次購物金。',
    heroKey: 'chaos-reward',
  },
  {
    id: 'chaos_month',
    mark: '✨',
    label: '本月限定',
    subtitle: '這個月正在推的。',
    heroKey: 'chaos-month',
  },
  {
    id: 'chaos_bundle',
    mark: '🎉',
    label: '限定組合',
    subtitle: '不講理但很爽的組合。',
    heroKey: 'chaos-bundle',
  },
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

export function buildJarHubItems(registered: boolean): {
  items: WorldMenuItem[];
  primaryId: string;
  body: string;
} {
  if (registered) {
    return {
      primaryId: 'jar_enter',
      body: '今天也來記一罐？',
      items: [
        {
          id: 'jar_enter',
          mark: '🔢',
          label: '輸入序號',
          subtitle: '罐底 8 碼，直接傳上來。',
          heroKey: 'jar-enter',
        },
        {
          id: 'jar_vault',
          mark: '🦴',
          label: '毛孩罐庫',
          subtitle: '點數、累積、可兌換。',
          heroKey: 'jar-vault',
        },
        {
          id: 'jar_history',
          mark: '🧾',
          label: '換罐紀錄',
          subtitle: '已輸入的序號在這。',
          heroKey: 'jar-history',
        },
        {
          id: 'jar_explain',
          mark: '♻️',
          label: '什麼是換罐',
          subtitle: '制度怎麼玩，看這裡。',
          heroKey: 'jar-explain',
        },
      ],
    };
  }

  return {
    primaryId: 'jar_reg',
    body: '第一次？先搞懂，再幫毛孩開戶。',
    items: [
      {
        id: 'jar_explain',
        mark: '♻️',
        label: '什麼是換罐',
        subtitle: '空罐不是垃圾，從這裡懂。',
        heroKey: 'jar-explain',
      },
      {
        id: 'jar_reg',
        mark: '🐾',
        label: '幫毛孩開戶',
        subtitle: '先認人，再記帳。',
        heroKey: 'jar-reg',
      },
      {
        id: 'jar_stores',
        mark: '🏪',
        label: '合作店家',
        subtitle: '折價綁哪間，先看清楚。',
        heroKey: 'jar-stores',
      },
      {
        id: 'jar_faq',
        mark: '❓',
        label: '常見問題',
        subtitle: '卡關時翻這頁。',
        heroKey: 'jar-faq',
      },
    ],
  };
}

export function buildWildItems(): WorldMenuItem[] {
  return [
    {
      id: 'wild_web',
      mark: '🌿',
      label: '官網',
      subtitle: '逛逛匠寵本營。',
      heroKey: 'wild-web',
      uri: undefined, // filled in flex-hubs with live links
    },
    {
      id: 'wild_ig',
      mark: '📷',
      label: 'Instagram',
      subtitle: '日常與出沒紀錄。',
      heroKey: 'wild-ig',
    },
    {
      id: 'wild_threads',
      mark: '🧵',
      label: 'Threads',
      subtitle: '短短的野外筆記。',
      heroKey: 'wild-threads',
    },
    {
      id: 'wild_fb',
      mark: '📘',
      label: 'Facebook',
      subtitle: '老朋友還在這。',
      heroKey: 'wild-fb',
    },
    {
      id: 'wild_news',
      mark: '📰',
      label: '最新故事',
      subtitle: '最近又跑去哪。',
      heroKey: 'wild-news',
    },
    {
      id: 'wild_stores',
      mark: '🗺️',
      label: '合作店家',
      subtitle: '地圖上的據點。',
      heroKey: 'wild-stores',
    },
    {
      id: 'wild_story',
      mark: '🏕️',
      label: '品牌故事',
      subtitle: '我們為什麼這樣做。',
      heroKey: 'wild-story',
    },
  ];
}

/** @deprecated */
export const JAR_EXPLAIN_TEXT = JAR_EXPLAIN_INTRO;
