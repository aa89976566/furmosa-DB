/**
 * 匠寵 LINE 四格漫畫世界。
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
  /**
   * 若設定：按鈕改送文字訊息（走 parseLineUserText），
   * 比 postback 更不容易因中間層例外而靜默。
   */
  message?: string;
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
  jar: '空罐也能幫毛孩累積好康。',
  chaos: '跟毛孩一起探索新鮮事',
  wild: '狗屋在裡面，院子也還亮著喔。',
};

export const JAR_ENTER_HINT_REGISTERED =
  '罐底那串 8 碼傳上來就好～\n我們會幫你記進毛孩名下喔。';

export const JAR_ENTER_BLOCKED_GUEST = `先幫毛孩開個戶喔～
開好戶之後，空罐序號才能入帳。`;

/** 一起野放：選單副標（不再另發開場長文） */
export const CHAOS_INTRO = '跟毛孩一起探索新鮮事';

/** 回家：不是官網首頁，是家 */
export const WILD_INTRO = `歡迎回家～
官網像狗屋，Instagram 像院子，都還亮著燈喔。`;

/** 換罐說明：點按鈕後的對話氣泡（台灣毛爸媽口吻） */
export const JAR_EXPLAIN_DIALOGUE = {
  intro: [
    '零食罐吃完先別丟喔，空罐還能幫毛孩存點數～',
    '罐底那串 8 碼傳上來，點數就會進你家毛孩名下。',
    '存滿 10 點可換美容折價約 200～250 元，實際金額看合作門市，每家不太一樣喔。',
  ],
  flow: [
    '玩法很簡單：先開戶、吃完零食、傳 8 碼、點數進會員，滿點再去綁定店折價。',
    '還沒開戶的話，先幫毛孩開戶，之後序號才能順利入帳喔。',
  ],
  faq: [
    '毛爸媽常問這幾題～',
    '一定要開戶嗎？要喔，開好戶序號才能進帳。一個 LINE 目前一戶一檔。',
    '想換店？開戶店就是折價店，要改跟我們說一聲就好。序號打錯再傳對的；用過的不能重複。點數本身不過期，折價券兌換後有 30 天使用期。',
  ],
} as const;

export const JAR_EXPLAIN_INTRO = JAR_EXPLAIN_DIALOGUE.intro.join('\n\n');
export const JAR_EXPLAIN_FLOW = JAR_EXPLAIN_DIALOGUE.flow.join('\n\n');
export const JAR_EXPLAIN_FAQ = JAR_EXPLAIN_DIALOGUE.faq.join('\n\n');

export const BRAND_STORY = `匠寵 Furmosa。
認真做給毛孩吃的手作零食，空罐也希望有好去處。

我們比較想像鄰居一樣跟毛爸媽說話：
好好照顧肚子，也把循環變成一件日常小事。

隨時歡迎進來坐坐喔。`;

/** 預約美容：好玩的「還沒好」文案（禁止「建設中」） */
export const GROOMING_SOON_LINES = [
  '洗澡水還在放，再一下下喔。',
  '美容師快到了，請毛孩再等等～',
  '還在幫前一位吹毛，馬上就好。',
  '毛巾還在轉，美容師也在準備中。',
  '水花有點大——再等一下下就輪到你們。',
  '剪刀還在磨，漂亮這件事急不得，謝謝耐心喔。',
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
    subtitle: '帶毛孩來玩「青蛙誰在怕」。',
    heroKey: 'chaos-frog',
    message: '嗷嗚計劃',
  },
  {
    id: 'chaos_events',
    mark: '🎪',
    label: '活動中心',
    subtitle: '最新活動都在這裡，歡迎逛逛。',
    heroKey: 'chaos-events',
    message: '活動中心',
  },
  {
    id: 'chaos_unbox',
    mark: '📦',
    label: '開箱任務',
    subtitle: '拆開、聞聞、吃吃、拍拍毛孩。',
    heroKey: 'chaos-unbox',
    message: '開箱任務',
  },
];

/**
 * 一起野放：點按鈕後的對話氣泡（對毛爸媽溫暖短句）。
 * 封面圖另送；這裡只放文字。
 */
export const CHAOS_DIALOGUE: Record<string, string[]> = {
  /** 嗷嗚計劃 → 青蛙誰在怕（獨立專案；無角色名） */
  chaos_aowu: [
    '歡迎來到「青蛙誰在怕」～',
    '這是青蛙凍乾小實測：看毛孩敢不敢碰、碰了什麼表情，拍下來就很好玩。',
    '專案頁準備好會直接帶你過去。拍完記得在 IG 標 @furmosa_food 喔。',
  ],
  chaos_frog: [
    '歡迎來到「青蛙誰在怕」～',
    '這是青蛙凍乾小實測：看毛孩敢不敢碰、碰了什麼表情，拍下來就很好玩。',
    '專案頁準備好會直接帶你過去。拍完記得在 IG 標 @furmosa_food 喔。',
  ],
  chaos_events: [
    '歡迎來到活動中心～這裡也叫「沒梗了」，海報在上面，先看一下就好。',
    '有有趣點子也歡迎跟我們說，說不定下一檔就是你家毛孩。',
  ],
  chaos_unbox: [
    '開箱任務很簡單喔：拆開、聞聞、讓毛孩吃吃，再拍下正在啃的可愛臉。',
    '拍完標 @furmosa_food，順手講一句心得就很棒了。',
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
      body: '有空罐序號就可以傳上來～想換好康，下面也有入口喔。',
      items: [
        {
          id: 'jar_explain',
          mark: '',
          label: '換罐計劃是什麼',
          subtitle: '怎麼玩、怎麼累積，先看這篇。',
          heroKey: 'jar-explain',
        },
        {
          id: 'jar_stores',
          mark: '',
          label: '配合店家',
          subtitle: '折價會綁哪一間，先確認一下。',
          heroKey: 'jar-stores',
        },
        {
          id: 'jar_enter',
          mark: '',
          label: '兌換序號',
          subtitle: '罐底 8 碼，傳上來就好。',
          heroKey: 'jar-enter',
        },
        {
          id: 'redeem',
          mark: '',
          label: '兌換好禮',
          subtitle: '點數可以換成實際好康。',
          heroKey: 'jar-vault',
        },
      ],
    };
  }

  return {
    primaryId: 'jar_reg',
    body: '第一次來沒關係～先了解換罐，再幫毛孩開戶就好。',
    items: [
      {
        id: 'jar_explain',
        mark: '',
        label: '換罐計劃是什麼',
        subtitle: '怎麼玩、怎麼累積，先看這篇。',
        heroKey: 'jar-explain',
      },
      {
        id: 'jar_reg',
        mark: '',
        label: '開戶',
        subtitle: '先幫毛孩開戶，之後序號才能入帳。',
        heroKey: 'jar-reg',
      },
      {
        id: 'jar_stores',
        mark: '',
        label: '配合店家',
        subtitle: '折價會綁哪一間，先確認一下。',
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
      label: '🏠 進狗屋（官網）',
      subtitle: '到 furmosa.com 逛逛官網狗屋。',
      heroKey: 'wild-web',
      uri: undefined,
    },
    {
      id: 'wild_ig',
      mark: '🌿',
      label: '🌿 去院子（Instagram）',
      subtitle: '@furmosa_food 院子還亮著燈喔。',
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
