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
  jar: '空罐先別丟，下一罐可以更划算喔。',
  chaos: '跟毛孩一起探索新鮮事',
  wild: '狗屋在裡面，院子也還亮著喔。',
};

export const JAR_ENTER_HINT_REGISTERED =
  '罐底那串 8 碼傳上來就好～\n我們會幫你記進毛孩名下喔。';

export const JAR_ENTER_BLOCKED_GUEST = `麻煩先幫毛孩開個戶喔～
開好戶，罐底序號才能幫你記進去。`;

/** 一起野放：選單副標（不再另發開場長文） */
export const CHAOS_INTRO = '跟毛孩一起探索新鮮事';

/** 回家：不是官網首頁，是家 */
export const WILD_INTRO = `歡迎回家～
官網像狗屋，Instagram 像院子，都還亮著燈喔。`;

/** 換罐說明：點按鈕後的對話氣泡（台灣毛爸媽口吻） */
export const JAR_EXPLAIN_DIALOGUE = {
  intro: [
    '目前換罐有棒棒牛、棒棒雞、脆脆鴨三款。',
    '首罐不計點；交回完整空罐並完成到店換罐後，每罐累積 1 點。',
    '集滿 10 點，可在累積點數的同一間合作店家兌換 NT$200 折價券。',
  ],
  /** @deprecated 流程改走 JAR_FLOW_STORY_STEPS（無圖故事卡） */
  flow: [
    '換罐是一段小小的循環故事，從第一罐開始。',
    '細節請看下面的流程卡喔。',
  ],
  faq: [
    '毛爸媽常問這幾題～',
    '一定要開戶嗎？要喔，開好戶序號才能進帳。一個 LINE 目前一戶一檔。',
    '點數與折價券限累積點數的同一間店家使用。序號打錯可以再傳正確的；用過的序號不能重複。點數本身不過期，折價券兌換後有 30 天使用期。',
  ],
} as const;

/**
 * 換罐流程：專業故事結構（八幕）
 * 無封面圖；給 Flex 故事卡使用。
 */
export const JAR_FLOW_STORY = {
  title: '換罐循環故事',
  subtitle: '從第一罐開始，一路變成日常。',
  steps: [
    {
      act: '1. 線上預購第一罐',
      beat: '從棒棒牛、棒棒雞、脆脆鴨選一款。第一罐 NT$129，不用帶空罐。',
    },
    {
      act: '2. 幫毛孩開戶',
      beat: '用 LINE 幫毛孩建立會員資料，之後就能查預購、換罐與點數紀錄。',
    },
    {
      act: '3. 選擇合作店家',
      beat: '選一間方便領取的合作店家；之後的點數與折價券都記在同一間店。',
    },
    {
      act: '4. 線上付款',
      beat: '確認品項並完成付款，等店家通知後再到店領取。',
    },
    {
      act: '5. 吃完保留完整空罐',
      beat: '空罐先不要丟，下次換罐要帶回同一間合作店家。',
    },
    {
      act: '6. 線上預購續罐',
      beat: '續罐價 NT$99。先選下一罐，再帶完整空罐到店。',
    },
    {
      act: '7. 到店完成換罐',
      beat: '店家確認並收回空罐後，交付預購的新罐。',
    },
    {
      act: '8. 完成後累積 1 點',
      beat: '首罐不計點；每次完成到店換罐累積 1 點，滿 10 點可在同一間店兌換 NT$200 折價券。',
    },
  ],
} as const;
export const JAR_EXPLAIN_INTRO = JAR_EXPLAIN_DIALOGUE.intro.join('\n\n');
export const JAR_EXPLAIN_FLOW = JAR_FLOW_STORY.steps
  .map((s) => `${s.act}\n${s.beat}`)
  .join('\n\n');
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
 * - 活動中心 → 邀請毛爸媽丟想法（bark 口吻）
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
    subtitle: '下一檔想聽你家毛孩的意見。',
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
  /** 活動中心：邀請丟想法（bark 口吻；勿再用對內 prompt 暱稱當對外名稱） */
  chaos_events: [
    '汪！活動中心報到～',
    '我們很想聽：毛孩最近在瘋什麼？你想跟我們一起玩什麼、試什麼？',
    '直接回這串丟想法就好，短短一句也行。你提的點子，搞不好下一檔活動就用上喔。',
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
 * 換罐計劃選單（台灣 20–40 毛爸媽口吻）。
 * 順序：什麼是換罐計劃？→ 開戶 →（有 LIFF）線上預購換罐 → 輸入序號（highlight）→ 點數換折價 → 毛爸媽常問
 */
export function buildJarHubItems(
  _registered: boolean,
  opts?: { registerLiffUrl?: string | null; refillLiffUrl?: string | null },
): {
  items: WorldMenuItem[];
  primaryId: string;
  body: string;
} {
  const items: WorldMenuItem[] = [
    {
      id: 'jar_explain_intro',
      mark: '',
      label: '什麼是換罐計劃？',
      subtitle: '空罐怎麼變成下一罐，先看這頁就懂。',
      heroKey: 'jar-explain',
      message: '什麼是換罐計劃？',
    },
    {
      id: 'jar_reg',
      mark: '',
      label: '幫毛孩開戶',
      subtitle: '開好戶，罐底序號才能進你家毛孩名下。',
      heroKey: 'jar-reg',
      ...(opts?.registerLiffUrl?.trim()
        ? { uri: opts.registerLiffUrl.trim() }
        : { message: '幫毛孩開戶' }),
    },
  ];

  const refillUrl = opts?.refillLiffUrl?.trim();
  if (refillUrl) {
    items.push({
      id: 'jar_refill_pay',
      mark: '',
      label: '線上預購換罐',
      subtitle: '預約確認後，在這裡付換罐款、預購下一罐。',
      heroKey: 'jar-explain',
      uri: refillUrl,
    });
  }

  items.push(
    {
      id: 'jar_enter',
      mark: '',
      label: '輸入序號',
      subtitle: '罐底那串 8 碼傳上來，就記進去囉。',
      heroKey: 'jar-enter',
      message: '輸入序號',
    },
    {
      id: 'jar_member',
      mark: '',
      label: '我的會員與紀錄',
      subtitle: '查毛孩資料、點數、序號與最近換罐紀錄。',
      heroKey: 'jar-vault',
      message: '我的會員與紀錄',
    },
    {
      id: 'redeem_coupon',
      mark: '',
      label: '點數換折價',
      subtitle: '存滿點數，換成合作店美容折價券。',
      heroKey: 'jar-vault',
      message: '點數換折價',
    },
    {
      id: 'jar_faq',
      mark: '',
      label: '毛爸媽常問',
      subtitle: '開戶、序號、折價這些一次看完。',
      heroKey: 'jar-faq',
      message: '毛爸媽常問',
    },
  );

  return {
    // 第一次進來先看懂計畫；輸入與會員操作留在下一層
    primaryId: 'jar_explain_intro',
    body: '',
    items,
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
