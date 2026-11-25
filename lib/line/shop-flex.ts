import type { LineReplyMessage } from '@/lib/line/reply';
import {
  getCartUrl,
  getCollectionUrl,
  getProductUrl,
  type LineShopCategory,
  type LineShopProduct,
} from '@/lib/line/shop-catalog';

const BLUE = '#123A70';
const PAPER = '#FFF9EC';

const CATEGORY_LABELS: Record<LineShopCategory, string> = {
  treats: '零食點心',
  toys: '玩具用品',
  services: '生活服務',
  all: '全部商品',
};

function messageButton(label: string, text: string, primary = false) {
  return {
    type: 'button',
    style: primary ? 'primary' : 'secondary',
    color: primary ? BLUE : undefined,
    height: 'sm',
    action: { type: 'message', label, text },
  };
}

export function buildShopHomeMessages(): LineReplyMessage[] {
  return [
    {
      type: 'flex',
      altText: '匠寵線上購物｜先選想逛的分類',
      contents: {
        type: 'bubble',
        styles: {
          body: { backgroundColor: PAPER },
          footer: { backgroundColor: PAPER },
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            {
              type: 'text',
              text: 'FURMOSA 匠寵',
              size: 'sm',
              color: BLUE,
              weight: 'bold',
            },
            {
              type: 'text',
              text: '今天想逛什麼？',
              size: 'xl',
              color: BLUE,
              weight: 'bold',
              wrap: true,
            },
            {
              type: 'text',
              text: '先在聊天室看商品，再到 LINE 內的購物車完成結帳。',
              size: 'sm',
              color: '#55708E',
              wrap: true,
            },
            { type: 'separator', color: '#FFD447', margin: 'md' },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            messageButton('零食點心', '逛零食', true),
            messageButton('玩具用品', '逛玩具'),
            messageButton('生活服務', '逛服務'),
            messageButton('全部商品', '逛全部'),
          ],
        },
      },
    },
  ];
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
          type: 'text', text: product.title, size: 'md', color: BLUE,
          weight: 'bold', wrap: true, maxLines: 2,
        },
        {
          type: 'text',
          text: product.variantTitle === 'Default Title' ? '單一規格' : product.variantTitle,
          size: 'xs', color: '#55708E', wrap: true, maxLines: 1,
        },
        {
          type: 'text', text: formatPrice(product.price), size: 'lg',
          color: BLUE, weight: 'bold',
        },
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', spacing: 'sm',
      contents: [
        {
          type: 'button', style: 'primary', color: BLUE, height: 'sm',
          action: { type: 'uri', label: '加入購物車', uri: getCartUrl(product) },
        },
        {
          type: 'button', style: 'secondary', height: 'sm',
          action: { type: 'uri', label: '看商品', uri: getProductUrl(product) },
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
      action: { type: 'uri', uri: getProductUrl(product) },
    };
  }
  return contents;
}

export function buildShopProductMessages(
  category: LineShopCategory,
  products: LineShopProduct[],
): LineReplyMessage[] {
  const label = CATEGORY_LABELS[category];
  if (products.length === 0) {
    return [{
      type: 'text',
      text: `${label}目前沒有可顯示的商品。你可以先逛全部商品。`,
      quickReply: {
        items: [{
          type: 'action',
          action: { type: 'uri', label: '前往商城', uri: getCollectionUrl('all') },
        }],
      },
    }];
  }
  return [{
    type: 'flex',
    altText: `匠寵線上購物｜${label}`,
    contents: { type: 'carousel', contents: products.slice(0, 10).map(productBubble) },
    quickReply: {
      items: [
        {
          type: 'action',
          action: { type: 'message', label: '換分類', text: '線上購物' },
        },
        {
          type: 'action',
          action: { type: 'uri', label: '逛完整商城', uri: getCollectionUrl(category) },
        },
      ],
    },
  }];
}

export function buildShopFallbackMessages(category: LineShopCategory): LineReplyMessage[] {
  return [{
    type: 'text',
    text: '商品卡剛剛讀取較慢，先帶你到匠寵商城，結帳仍會在 LINE 內開啟。',
    quickReply: {
      items: [{
        type: 'action',
        action: { type: 'uri', label: '前往商城', uri: getCollectionUrl(category) },
      }],
    },
  }];
}

export { CATEGORY_LABELS };
