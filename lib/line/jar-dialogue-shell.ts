/**
 * 換罐計劃 Flex 對話框共用底圖。
 * LINE box 不支援 CSS background-image，改以 absolute image 鋪滿。
 * 區塊第一個子元件不可 absolute，故先放 1px filler 錨點。
 */

/** 狗鼻底圖（新檔名破 LINE CDN 快取） */
export const JAR_DIALOGUE_BG_PATH = '/images/refill-plan/dialogue-bg-nose-v2.jpg';

const CREAM = '#F8F3EA';

type FlexComponent = Record<string, unknown>;

function publicAssetUrl(path: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || '';
  const looksEphemeral =
    /vercel\.app$/i.test(configured) &&
    !/^https:\/\/furmosa-db\.vercel\.app\/?$/i.test(configured);
  const base =
    configured && !looksEphemeral
      ? configured
      : 'https://furmosa-db.vercel.app';
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base.replace(/\/$/, '')}${clean}`;
}

/**
 * 把內容包在狗鼻底圖上（僅 body 區塊）。
 */
export function withJarDialogueBackground(
  innerContents: FlexComponent[],
  opts?: { paddingAll?: string; spacing?: string },
): FlexComponent {
  return {
    type: 'box',
    layout: 'vertical',
    paddingAll: '0px',
    backgroundColor: CREAM,
    contents: [
      {
        type: 'box',
        layout: 'vertical',
        position: 'relative',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            width: '1px',
            height: '1px',
            contents: [{ type: 'filler' }],
          },
          {
            type: 'image',
            url: publicAssetUrl(JAR_DIALOGUE_BG_PATH),
            size: 'full',
            aspectMode: 'cover',
            position: 'absolute',
            gravity: 'center',
            offsetTop: '0px',
            offsetBottom: '0px',
            offsetStart: '0px',
            offsetEnd: '0px',
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: opts?.spacing ?? 'md',
            paddingAll: opts?.paddingAll ?? '18px',
            contents: innerContents,
          },
        ],
      },
    ],
  };
}

/**
 * 完整 bubble：標題區 + 按鈕區都鋪同一張底圖（避免 footer 色塊斷開）。
 */
export function buildJarDialogueBubble(opts: {
  bodyContents: FlexComponent[];
  footerContents?: FlexComponent[];
  spacing?: string;
  paddingAll?: string;
}): FlexComponent {
  const inner: FlexComponent[] = [...opts.bodyContents];
  if (opts.footerContents?.length) {
    inner.push({
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      margin: 'lg',
      contents: opts.footerContents,
    });
  }
  return {
    type: 'bubble',
    size: 'mega',
    styles: {
      body: { backgroundColor: CREAM },
    },
    body: withJarDialogueBackground(inner, {
      spacing: opts.spacing ?? 'sm',
      paddingAll: opts.paddingAll ?? '18px',
    }),
  };
}
