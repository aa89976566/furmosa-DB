import type { LineReplyMessage } from '@/lib/line/reply';
import type { LineShopCategory, LineShopProduct } from '@/lib/line/shop-catalog';

const PAPER = '#FFF9EC';
const BLUE = '#123A70';
const SITE_PAPER = '#F8F6EF';
const SITE_SURFACE = '#FFFDF8';
const SITE_BLUE = '#203E54';
const SITE_MUTED = '#60717D';
const SITE_LINE = '#DEDBD5';
const SHOP_HERO_PATH = '/line/shop/bark-sniff-shopping-hero-v1.jpg';

function publicAssetUrl(path: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || '';
  const looksEphemeral =
    /vercel\.app$/i.test(configured) &&
    !/^https:\/\/furmosa-db\.vercel\.app\/?$/i.test(configured);
  const base = configured && !looksEphemeral ? configured : 'https://hq.furmosa.com';
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base.replace(/\/$/, '')}${clean}`;
}

const CATEGORY_LABELS: Record<LineShopCategory, string> = {
  treats: '零食點心',
  toys: '玩具用品',
  gifts: '禮品選物',
  lifestyle: '生活用品',
  all: '全部商品',
};

export function buildLegacyShopHomeMessages(): LineReplyMessage[] {
  return [{
    type: 'flex',
    altText: '匠寵線上購物｜想找哪一種？',
    contents: {
      type: 'bubble',
      size: 'mega',
      styles: {
        hero: { backgroundColor: PAPER },
        body: { backgroundColor: PAPER },
      },
      hero: {
        type: 'image',
        url: publicAssetUrl(SHOP_HERO_PATH),
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover',
        backgroundColor: PAPER,
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '18px',
        contents: [
          {
            type: 'text',
            text: '想找哪一種？',
            size: 'xl',
            weight: 'bold',
            color: BLUE,
          },
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              {
                type: 'button', style: 'link', height: 'sm',
                action: { type: 'message', label: '零食', text: '逛零食' },
              },
              {
                type: 'button', style: 'link', height: 'sm',
                action: { type: 'message', label: '玩具', text: '逛玩具' },
              },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              {
                type: 'button', style: 'link', height: 'sm',
                action: { type: 'message', label: '禮品', text: '逛禮品' },
              },
              {
                type: 'button', style: 'link', height: 'sm',
                action: { type: 'message', label: '生活用品', text: '逛生活用品' },
              },
            ],
          },
        ],
      },
    },
  }];
}

function categoryPostback(category: LineShopCategory, label: string) {
  return {
    type: 'action' as const,
    action: {
      type: 'postback' as const,
      label,
      data: `jd=shop_category&category=${category}`,
      displayText: label,
    },
  };
}

function categoryQuickReplies() {
  return [
    categoryPostback('treats', '零食'),
    categoryPostback('toys', '玩具'),
    categoryPostback('gifts', '禮品'),
    categoryPostback('lifestyle', '生活用品'),
  ];
}

function cartQuickReply() {
  return {
    type: 'action' as const,
    action: {
      type: 'postback' as const,
      label: '購物車',
      data: 'jd=shop_cart',
      displayText: '查看購物車',
    },
  };
}

export function buildShopHomeMessages(): LineReplyMessage[] {
  return [{
    type: 'text',
    text: '想幫毛孩找哪一種？',
    quickReply: { items: [...categoryQuickReplies(), cartQuickReply()] },
  }];
}

function formatPrice(price: number) {
  return `NT$${Math.round(price).toLocaleString('zh-TW')}`;
}

function productBubble(product: LineShopProduct) {
  const contents: Record<string, unknown> = {
    type: 'bubble',
    size: 'kilo',
    styles: {
      body: { backgroundColor: PAPER },
      footer: { backgroundColor: PAPER },
    },
    body: {
      type: 'box', layout: 'vertical', spacing: 'sm',
      contents: [
        {
          type: 'button', style: 'link', height: 'sm',
          action: {
            type: 'postback',
            label: '看商品介紹',
            data: `jd=shop_product&variant=${encodeURIComponent(product.variantId)}`,
            displayText: `想了解：${product.title}`,
          },
        },
        {
          type: 'text', text: product.title, size: 'md', color: BLUE,
          weight: 'bold', wrap: true, maxLines: 2,
        },
        {
          type: 'text', text: formatPrice(product.price), size: 'lg',
          color: BLUE, weight: 'bold',
        },
      ],
    },
    footer: {
      type: 'box', layout: 'vertical',
      contents: [
        {
          type: 'button', style: 'link', height: 'sm',
          action: {
            type: 'postback',
            label: '加入購物車',
            data: `jd=shop_add&variant=${encodeURIComponent(product.variantId)}`,
            displayText: `加入購物車：${product.title}`,
          },
        },
      ],
    },
  };
  if (product.imageUrl) {
    contents.hero = {
      type: 'image',
      url: product.imageUrl,
      size: 'full',
      aspectRatio: '1:1',
      aspectMode: 'cover',
      action: {
        type: 'postback',
        data: `jd=shop_product&variant=${encodeURIComponent(product.variantId)}`,
      },
    };
  }
  return contents;
}

export function buildShopProductMessages(
  category: LineShopCategory,
  products: LineShopProduct[],
  options: { page?: number } = {},
): LineReplyMessage[] {
  const label = CATEGORY_LABELS[category];
  if (products.length === 0) {
    return [{
      type: 'text',
      text: `${label}目前沒有可顯示的商品。你可以先逛全部商品。`,
      quickReply: { items: categoryQuickReplies() },
    }];
  }
  const pageSize = 5;
  const maxPage = Math.max(1, Math.ceil(products.length / pageSize));
  const page = Math.min(maxPage, Math.max(1, Math.floor(options.page ?? 1)));
  const start = (page - 1) * pageSize;
  const visible = products.slice(start, start + pageSize);
  const hasMore = products.length > start + pageSize;
  const cards = visible.map(productBubble);
  if (hasMore) {
    cards.push({
      type: 'bubble',
      size: 'kilo',
      styles: {
        body: { backgroundColor: PAPER },
        footer: { backgroundColor: PAPER },
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'md',
        contents: [
          { type: 'text', text: `還有更多${label}`, size: 'lg', color: BLUE, weight: 'bold', wrap: true },
          { type: 'text', text: '繼續在 LINE 裡慢慢看。', size: 'sm', color: '#5B6F86', wrap: true },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [{
          type: 'button', style: 'link', height: 'sm',
          action: {
            type: 'postback',
            label: '看更多',
            data: `jd=shop_more&category=${category}&page=${page + 1}`,
            displayText: `看更多${label}`,
          },
        }],
      },
    });
  }
  return [{
    type: 'flex',
    altText: `匠寵線上購物｜${label}`,
    contents: { type: 'carousel', contents: cards },
    quickReply: {
      items: [
        cartQuickReply(),
        ...categoryQuickReplies(),
        {
          type: 'action',
          action: { type: 'postback', label: '回購物首頁', data: 'jd=shop_home', displayText: '回購物首頁' },
        },
      ],
    },
  }];
}

export function buildShopProductDetailMessages(product: LineShopProduct): LineReplyMessage[] {
  const description = product.description || '這項商品的完整介紹正在整理中；價格與規格以目前卡片顯示為準。';
  const summaryContents: Record<string, unknown>[] = [];
  if (product.imageUrl) {
    summaryContents.push({
      type: 'image',
      url: product.imageUrl,
      size: 'full',
      aspectRatio: '1:1',
      aspectMode: 'cover',
      backgroundColor: SITE_PAPER,
      flex: 2,
    });
  }
  summaryContents.push({
    type: 'box',
    layout: 'vertical',
    spacing: 'sm',
    paddingAll: '16px',
    flex: 3,
    contents: [
      { type: 'text', text: product.productType || '匠寵選物', size: 'xs', color: SITE_MUTED, wrap: true },
      { type: 'text', text: product.title, size: 'lg', color: SITE_BLUE, weight: 'bold', wrap: true, maxLines: 2 },
      { type: 'text', text: formatPrice(product.price), size: 'xl', color: SITE_BLUE, weight: 'bold' },
    ],
  });
  const bubble: Record<string, unknown> = {
    type: 'bubble',
    size: 'mega',
    styles: {
      body: { backgroundColor: SITE_PAPER },
      footer: { backgroundColor: SITE_PAPER },
    },
    body: {
      type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '14px',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          backgroundColor: SITE_SURFACE,
          cornerRadius: '18px',
          contents: summaryContents,
        },
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          paddingAll: '16px',
          backgroundColor: SITE_SURFACE,
          cornerRadius: '18px',
          contents: [
            { type: 'text', text: '商品介紹', size: 'xs', color: SITE_MUTED },
            { type: 'text', text: description, size: 'sm', color: SITE_BLUE, wrap: true, maxLines: 5 },
            { type: 'separator', color: SITE_LINE, margin: 'md' },
            {
              type: 'box', layout: 'horizontal', alignItems: 'center',
              contents: [
                { type: 'text', text: '規格', size: 'xs', color: SITE_MUTED, flex: 0 },
                { type: 'text', text: product.variantTitle, size: 'sm', color: SITE_BLUE, weight: 'bold', align: 'end', wrap: true },
              ],
            },
          ],
        },
      ],
    },
    footer: {
      type: 'box', layout: 'horizontal', spacing: 'sm', paddingAll: '14px', paddingTop: '0px',
      contents: [
        {
          type: 'button', style: 'secondary', height: 'sm',
          action: {
            type: 'postback', label: '繼續逛',
            data: 'jd=shop_home',
            displayText: '繼續逛商品',
          },
        },
        {
          type: 'button', style: 'primary', color: SITE_BLUE, height: 'sm',
          action: {
            type: 'postback', label: '加入購物車',
            data: `jd=shop_add&variant=${encodeURIComponent(product.variantId)}`,
            displayText: `加入購物車：${product.title}`,
          },
        },
      ],
    },
  };
  return [{
    type: 'flex', altText: `${product.title}｜商品介紹`, contents: bubble,
    quickReply: { items: [cartQuickReply(), ...categoryQuickReplies()] },
  }];
}

export function buildShopFallbackMessages(category: LineShopCategory): LineReplyMessage[] {
  return [{
    type: 'text',
    text: `${CATEGORY_LABELS[category]}剛剛讀取比較慢。可以再試一次，或先看看其他分類。`,
    quickReply: { items: [
      {
        type: 'action',
        action: {
          type: 'postback', label: '再試一次',
          data: `jd=shop_category&category=${category}`,
          displayText: `再看一次${CATEGORY_LABELS[category]}`,
        },
      },
      ...categoryQuickReplies(),
    ] },
  }];
}

export { CATEGORY_LABELS };
