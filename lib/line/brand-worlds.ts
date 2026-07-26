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

/** 換罐說明：點按鈕後的對話氣泡 */
export const JAR_EXPLAIN_DIALOGUE = {
  intro: [
    '空罐不是垃圾啦。',
    '吃完把罐底那串 8 碼丟上來，點數進毛孩名下。',
    '滿 10 點換美容折價——豬窩 250，其他合作店 200。瓶子才是主角。',
  ],
  flow: [
    '怎麼玩很短：先開戶、吃完零食、傳 8 碼、點數進會員、滿點去綁定店折。',
    '沒開戶不能存罐。先認人，再記帳。',
  ],
  faq: [
    '常被問的幾題——',
    '一定要開戶嗎？要，沒戶頭序號進不來。一個 LINE 目前一戶一檔。',
    '換店？開戶店就是折價店，要改跟我們說。序號打錯再傳對的；用過的不能重複。點數本身不過期，折價券兌換後有 30 天使用期。',
  ],
} as const;

export const JAR_EXPLAIN_INTRO = JAR_EXPLAIN_DIALOGUE.intro.join('\n\n');
export const JAR_EXPLAIN_FLOW = JAR_EXPLAIN_DIALOGUE.flow.join('\n\n');
export const JAR_EXPLAIN_FAQ = JAR_EXPLAIN_DIALOGUE.faq.join('\n\n');

export const BRAND_STORY = `匠寵 Furmosa。
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

/**
 * 一起野放：三鍵
 * - 嗷嗚計劃 → 青蛙誰在怕（獨立專案；網址後補）
 * - 活動中心 → 沒梗了
 * - 開箱任務 → 雞霸開箱對話流程
 */
export const CHAOS_ITEMS: WorldMenuItem[] = [
  {
    id: 'chaos_aowu',
    mark: '🐸',
    label: '嗷嗚計劃',
    subtitle: '進青蛙誰在怕。誰在怕？先別回答。',
    heroKey: 'chaos-frog',
  },
  {
    id: 'chaos_events',
    mark: '🎪',
    label: '活動中心',
    subtitle: '沒梗了——給個爛點子也好玩。',
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

/**
 * 一起野放：點按鈕後的對話氣泡（店員口吻，短句連發）。
 * 封面圖另送；這裡只放文字。
 */
export const CHAOS_DIALOGUE: Record<string, string[]> = {
  chaos_aowu: [
    '這格寫嗷嗚，開門其實是「青蛙誰在怕」。',
    '傑克在追，青蛙在逃——有人已經先叫了。毛孩敢不敢碰青蛙凍乾、碰了什麼臉，拍下來就好。',
    '專案頁好了會直接帶你過去。IG 記得標 @furmosa_food。',
  ],
  chaos_frog: [
    '這格寫嗷嗚，開門其實是「青蛙誰在怕」。',
    '傑克在追，青蛙在逃——有人已經先叫了。毛孩敢不敢碰青蛙凍乾、碰了什麼臉，拍下來就好。',
    '專案頁好了會直接帶你過去。IG 記得標 @furmosa_food。',
  ],
  chaos_events: [
    '活動區來了，牌子有點直——叫「沒梗了」。海報在上面，先瞄一眼。',
    '有爛點子也行，說不定很好玩。',
  ],
  chaos_unbox: [
    '開箱任務很單純啦。拆、聞、吃、拍——尤其是正在啃的那張臉。',
    '拍完標 @furmosa_food，講一句真心話就好。',
  ],
};

/** @deprecated 舊單塊文案；新路徑用 CHAOS_DIALOGUE */
export const CHAOS_COPY: Record<string, string> = Object.fromEntries(
  Object.entries(CHAOS_DIALOGUE).map(([id, lines]) => [id, lines.join('\n\n')]),
);

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
      mark: '',
      label: '開飯去（官網）',
      subtitle: 'furmosa.com——門開著。',
      heroKey: 'wild-web',
      uri: undefined,
    },
    {
      id: 'wild_ig',
      mark: '',
      label: '去厝邊（IG）',
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
