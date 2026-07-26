/**
 * 匠寵 LINE 四格漫畫世界——跟著一隻 Jack Russell 過一天。
 * 不是功能儀表板；是小漫畫分頁。
 */

export type WorldHubId = 'jar' | 'chaos' | 'wild';

export type WorldMenuItem = {
  id: string;
  /** 卡片主標 */
  label: string;
  /** 大記號（手繪感，非 app icon） */
  mark: string;
  /** 一行副標 */
  subtitle: string;
  /** public/line/cards/{heroKey}.png */
  heroKey: string;
  uri?: string;
};

export const WORLD_HUB_LABELS: Record<WorldHubId, string> = {
  jar: '換罐計劃',
  chaos: '一起野放',
  wild: '回家',
};

export const WORLD_HUB_EMOJI: Record<WorldHubId, string> = {
  jar: '🫙',
  chaos: '🐾',
  wild: '🏠',
};

export const WORLD_HUB_TAGLINE: Record<WorldHubId, string> = {
  jar: '瓶子才是主角。',
  chaos: '外面比較好玩。',
  wild: '門開著，故事還在。',
};

export const JAR_ENTER_HINT_REGISTERED =
  '罐底那串 8 碼，直接丟上來。\n我們幫你記進毛孩名下。';

export const JAR_ENTER_BLOCKED_GUEST = `先開戶。
沒戶頭，罐進不來。`;

/** 一起野放：外頭正在發生的事 */
export const CHAOS_INTRO = '傑克往外衝了。外面比較好玩——點下面按鈕跟去。';

/** 回家：不是官網首頁，是家 */
export const WILD_INTRO = '門開著。鞋子可以脫了。還想晃就接著晃。';

export const JAR_EXPLAIN_INTRO = `【換罐說明】

空罐不是垃圾。
吃完，罐底 8 碼丟給我們，點數進毛孩名下。

滿 10 點換美容折價：
豬窩 250／其他合作店 200。

這是會員制度，不是抽獎活動。
瓶子才是主角。`;

export const JAR_EXPLAIN_FLOW = `【怎麼玩】

① 開戶（綁一間合作美容店）
② 吃完零食
③ 傳罐底 8 碼
④ 點數進「我的會員」
⑤ 滿點換折價，到綁定店用

沒開戶不能存罐。先認人，再記帳。`;

export const JAR_EXPLAIN_FAQ = `【常見問題】

Q：一定要開戶嗎？
A：要。沒戶頭，序號進不來。

Q：一個 LINE 能綁幾隻毛孩？
A：目前一戶一檔；多毛孩先跟我們說。

Q：換了店怎麼辦？
A：開戶店永久綁定折價使用店。要改請跟我們說。

Q：序號打錯？
A：再傳一次對的 8 碼；用過的不能重複。

Q：點數會過期嗎？
A：點數本身不過期；折價券兌換後有使用期限（30 天）。`;

export const BRAND_STORY = `【回家路上的故事】

匠寵 Furmosa。
零食要手作質感，空罐也要有去處。

我們不愛講很公司的話。
比較像：認真做給毛孩吃的東西，
順便把循環玩成一件日常小事。

門還開著。`;

/** 預約美容：好玩的「還沒好」文案（禁止「建設中」） */
export const GROOMING_SOON_LINES = [
  '洗澡水還沒放滿。',
  '美容師快到了。',
  '還在吹毛。',
  '毛巾在轉，人還沒就位。',
  '傑克剛跳進盆，水花四濺——再等一下。',
  '剪刀還沒磨利。漂亮這件事，急不得。',
] as const;

export function pickGroomingSoonLine(seed?: number): string {
  const i =
    typeof seed === 'number'
      ? Math.abs(seed) % GROOMING_SOON_LINES.length
      : Math.floor(Math.random() * GROOMING_SOON_LINES.length);
  return GROOMING_SOON_LINES[i]!;
}

/** 一起野放：社區／UGC／活動 */
export const CHAOS_ITEMS: WorldMenuItem[] = [
  {
    id: 'chaos_aowu',
    mark: '📣',
    label: '嗷嗚計劃',
    subtitle: '真實吃貨現場。不當演員。',
    heroKey: 'chaos-aowu',
  },
  {
    id: 'chaos_frog',
    mark: '🐸',
    label: '青蛙誰在怕',
    subtitle: '誰在怕？先別回答。',
    heroKey: 'chaos-frog',
  },
  {
    id: 'chaos_events',
    mark: '🎪',
    label: '活動',
    subtitle: '給個爛點子，說不定很好玩。',
    heroKey: 'chaos-events',
  },
  {
    id: 'chaos_unbox',
    mark: '📦',
    label: '開箱任務',
    subtitle: '拆、聞、吃、拍。就這樣。',
    heroKey: 'chaos-unbox',
  },
];

export const CHAOS_COPY: Record<string, string> = {
  chaos_aowu: `【嗷嗚計劃】

拍真實吃貨現場，不當演員。

拆箱、聞味道、正在啃——
這些臉比長文有用。

想參加就回：我要參加嗷嗚
並留下收件資料。

IG 記得標 @furmosa_food`,

  chaos_events: `【活動】

給個爛點子，
說不定很好玩。`,

  chaos_unbox: `【開箱任務】

任務很單純：

• 開箱瞬間
• 聞到味道的臉
• 正在吃
• 產品＋毛孩合照

拍完標 @furmosa_food
講一句真心話就好。`,

  chaos_frog: `【青蛙誰在怕】

青蛙：誰在怕？

傑克在追。青蛙在逃。
有人已經先尖叫了。

青蛙凍乾實測場——
毛孩敢不敢碰、碰了什麼表情，拍下來。

想參加就回：我要參加青蛙
（舊口令「我要參加清蛙」也認）

IG 標 @furmosa_food`,

  chaos_guide: `【拍攝指南】

請拍這些就好（3–5 張或短影片）：

• 開箱瞬間
• 聞到味道的臉
• 正在吃的畫面
• 產品＋毛孩合照

IG 標：@furmosa_food

現在主要入口在「開箱任務」。`,

  chaos_reward: `【完成拿 100 元】

依開箱／嗷嗚交件並標註，
審核通過後發給下次購物金 NT$100。

不是抽獎。做完、合格，再領。`,

  chaos_month: `【本月限定】

改掛在「活動」。
這個月有什麼，去一起野放看。`,

  chaos_bundle: `【限定組合】

改掛在「活動」。
有開才掛。`,
};

/**
 * 換罐計劃：依是否已綁 LINE／開戶變形。
 * - 未開戶：介紹、開戶、配合店家
 * - 已開戶：不再出現開戶；介紹、配合店家、兌換序號、兌換好禮
 */
export function buildJarHubItems(registered: boolean): {
  items: WorldMenuItem[];
  primaryId: string;
  body: string;
} {
  if (registered) {
    return {
      primaryId: 'jar_enter',
      body: '瓶子來了就丟序號。想換好康，下面也有。',
      items: [
        {
          id: 'jar_explain',
          mark: '',
          label: '換罐計劃是什麼',
          subtitle: '制度怎麼玩。瓶子才是主角。',
          heroKey: 'jar-explain',
        },
        {
          id: 'jar_stores',
          mark: '',
          label: '配合店家',
          subtitle: '折價綁哪間，先看清楚。',
          heroKey: 'jar-stores',
        },
        {
          id: 'jar_enter',
          mark: '',
          label: '兌換序號',
          subtitle: '罐底 8 碼，丟上來就好。',
          heroKey: 'jar-enter',
        },
        {
          id: 'redeem',
          mark: '',
          label: '兌換好禮',
          subtitle: '點數換成實際好康。',
          heroKey: 'jar-vault',
        },
      ],
    };
  }

  return {
    primaryId: 'jar_reg',
    body: '第一次？先搞懂換罐，再幫毛孩開戶。',
    items: [
      {
        id: 'jar_explain',
        mark: '',
        label: '換罐計劃是什麼',
        subtitle: '制度怎麼玩。瓶子才是主角。',
        heroKey: 'jar-explain',
      },
      {
        id: 'jar_reg',
        mark: '',
        label: '開戶',
        subtitle: '先認人。沒戶頭，罐進不來。',
        heroKey: 'jar-reg',
      },
      {
        id: 'jar_stores',
        mark: '',
        label: '配合店家',
        subtitle: '折價綁哪間，先看清楚。',
        heroKey: 'jar-stores',
      },
    ],
  };
}

/** 回家：官網＋IG，讓人自然繼續晃 */
export function buildHomeItems(): WorldMenuItem[] {
  return [
    {
      id: 'wild_web',
      mark: '🏠',
      label: '回家',
      subtitle: 'furmosa.com——門開著。',
      heroKey: 'wild-web',
      uri: undefined,
    },
    {
      id: 'wild_ig',
      mark: '📷',
      label: 'Instagram',
      subtitle: '@furmosa_food 日常出沒。',
      heroKey: 'wild-ig',
    },
  ];
}

/** @deprecated 舊野放中七卡；回家已收斂為 buildHomeItems */
export function buildWildItems(): WorldMenuItem[] {
  return buildHomeItems();
}

/** @deprecated */
export const JAR_EXPLAIN_TEXT = JAR_EXPLAIN_INTRO;
