import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import type { CouponView } from '@/lib/coupons/service';
import { formatCouponStatus } from '@/lib/coupons/labels';
import {
  GROOMING_COUPON_DISCOUNT,
  GROOMING_COUPON_POINTS,
} from '@/lib/coupons/constants';
import { LINE_BTN, LINE_COUPON_VERIFY_HINT } from '@/lib/line/line-copy';
import type { LineReplyMessage } from '@/lib/line/reply';

function fmtDate(d: Date) {
  return format(d, 'yyyy/MM/dd', { locale: zhTW });
}

function couponBubble(c: CouponView, title: string) {
  const statusLine = formatCouponStatus(c.status);
  const redeemedLine =
    c.status === 'redeemed' && c.redeemedAt
      ? `\n核銷時間：${format(c.redeemedAt, 'yyyy/MM/dd HH:mm')}${
          c.redeemedStore ? `\n核銷店家：${c.redeemedStore}` : ''
        }`
      : '';

  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        { type: 'text', text: title, weight: 'bold', size: 'sm', color: '#1a1a1a' },
        {
          type: 'text',
          text: [
            `優惠券編號：${c.couponCode}`,
            `折抵金額：${c.discountAmount} 元`,
            `適用店家：${c.storeName}`,
            `有效期限：${fmtDate(c.expiresAt)}`,
            `狀態：${statusLine}`,
            redeemedLine,
          ]
            .filter(Boolean)
            .join('\n'),
          size: 'xs',
          color: '#444444',
          wrap: true,
        },
        ...(c.status === 'available'
          ? [
              {
                type: 'text',
                text: LINE_COUPON_VERIFY_HINT,
                size: 'xxs',
                color: '#b45309',
                wrap: true,
                margin: 'md',
              },
            ]
          : []),
      ],
    },
  };
}

export function buildCouponListMessages(groups: {
  available: CouponView[];
  redeemed: CouponView[];
  expired: CouponView[];
}): LineReplyMessage[] {
  const all = [
    ...groups.available.map((c) => ({ c, title: '未使用' })),
    ...groups.redeemed.map((c) => ({ c, title: '已使用' })),
    ...groups.expired.map((c) => ({ c, title: '已過期' })),
  ];

  if (all.length === 0) {
    return [
      {
        type: 'text',
        text: '目前沒有優惠券。累積 10 點可兌換美容折 250 元，請點「兌換美容折250元」。',
      },
    ];
  }

  const bubbles = all.slice(0, 10).map(({ c, title }) => couponBubble(c, title));
  if (all.length > 10) {
    bubbles.push({
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: `另有 ${all.length - 10} 張優惠券未顯示，請至後台或聯絡客服查詢。`,
            size: 'xs',
            wrap: true,
            color: '#666666',
          },
        ],
      },
    });
  }

  return [{ type: 'flex', altText: '我的優惠券', contents: { type: 'carousel', contents: bubbles } }];
}

export function buildGroomingRedeemConfirmMessages(opts: {
  storeName: string;
  pointsBalance: number;
}): LineReplyMessage[] {
  return [
    {
      type: 'flex',
      altText: '兌換美容折價券',
      contents: {
        type: 'bubble',
        size: 'mega',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            { type: 'text', text: '兌換美容折 250 元', weight: 'bold', size: 'md' },
            {
              type: 'text',
              text: [
                `消耗點數：${GROOMING_COUPON_POINTS} 點`,
                `目前餘額：${opts.pointsBalance} 點`,
                `折抵金額：${GROOMING_COUPON_DISCOUNT} 元`,
                `適用店家：${opts.storeName}`,
                '有效期限：兌換後 30 天',
              ].join('\n'),
              size: 'xs',
              color: '#444444',
              wrap: true,
            },
            {
              type: 'text',
              text: LINE_COUPON_VERIFY_HINT,
              size: 'xxs',
              color: '#b45309',
              wrap: true,
              margin: 'md',
            },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'primary',
              height: 'sm',
              action: {
                type: 'postback',
                label: LINE_BTN.confirmGroomingRedeem,
                data: 'jd=cp_groom_ok',
                displayText: LINE_BTN.confirmGroomingRedeem,
              },
            },
          ],
        },
      },
    },
  ];
}

export function formatGroomingRedeemSuccessMessage(opts: {
  couponCode: string;
  storeName: string;
  discountAmount: number;
  expiresAt: Date;
  balanceAfter: number;
}) {
  return [
    '🎁 兌換成功',
    '',
    `優惠券編號：${opts.couponCode}`,
    `折抵金額：${opts.discountAmount} 元`,
    `適用店家：${opts.storeName}`,
    `有效期限：${fmtDate(opts.expiresAt)}`,
    `剩餘點數：${opts.balanceAfter} 點`,
    '',
    LINE_COUPON_VERIFY_HINT,
  ].join('\n');
}

export function formatUsedCouponError(c: CouponView) {
  const lines = ['❌ 此優惠券已使用'];
  if (c.redeemedStore) lines.push(`核銷店家：${c.redeemedStore}`);
  if (c.redeemedAt) lines.push(`核銷時間：${format(c.redeemedAt, 'yyyy/MM/dd HH:mm')}`);
  return lines.join('\n');
}
