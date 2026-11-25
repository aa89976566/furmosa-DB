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
          action: { type: 'message', label: '零食', text: '逛零食' },
        },
        {
          type: 'action',
          action: { type: 'message', label: '玩具', text: '逛玩具' },
        },
        {
          type: 'action',
          action: { type: 'message', label: '全部', text: '逛全部' },
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
