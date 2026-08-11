import { writeFileSync } from 'node:fs';
import {
  REFILL_EXCHANGE_PREVIEW_STATE_LABELS,
  REFILL_EXCHANGE_PREVIEW_STATES,
  buildRefillExchangePreviewMessages,
} from '../lib/refill/exchange-entitlement-preview';

const SIZE: Record<string, string> = {
  xxs: '10px',
  xs: '12px',
  sm: '14px',
  md: '16px',
  lg: '18px',
  xl: '20px',
  xxl: '24px',
};

type FlexNode = Record<string, unknown> & {
  type?: string;
  text?: string;
  size?: string;
  weight?: string;
  color?: string;
  wrap?: boolean;
  layout?: string;
  backgroundColor?: string;
  borderColor?: string;
  cornerRadius?: string;
  paddingAll?: string;
  contents?: FlexNode[];
  body?: FlexNode;
  footer?: FlexNode;
  action?: { label?: string };
};

function renderNode(node: FlexNode | undefined): string {
  if (!node || typeof node !== 'object') return '';
  const t = node.type;
  if (t === 'text') {
    const size = SIZE[node.size ?? 'sm'] ?? '14px';
    const weight = node.weight === 'bold' ? '700' : '400';
    const color = node.color ?? '#2E231D';
    const whiteSpace =
      node.wrap === false
        ? 'nowrap; overflow:hidden; text-overflow:ellipsis'
        : 'pre-wrap; overflow-wrap:anywhere';
    const text = String(node.text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;');
    return `<p data-size="${node.size ?? 'sm'}" data-weight="${node.weight ?? 'regular'}" style="margin:4px 0;font-size:${size};font-weight:${weight};color:${color};white-space:${whiteSpace};line-height:1.4;max-width:100%">${text}</p>`;
  }
  if (t === 'separator') {
    return '<hr style="border:none;border-top:1px solid #E5DCCE;margin:10px 0"/>';
  }
  if (t === 'button') {
    const label = node.action?.label ?? '按鈕';
    return `<div style="border:1px solid #F4C7A5;background:#fff;border-radius:12px;padding:10px;text-align:center;font-size:14px;font-weight:600;margin:6px 0">${label}</div>`;
  }
  if (t === 'box' || t === 'bubble') {
    const layout = node.layout === 'horizontal' ? 'row' : 'column';
    const bg =
      node.backgroundColor ?? (t === 'bubble' ? '#F8F3EA' : 'transparent');
    const border = node.borderColor
      ? `2px solid ${node.borderColor}`
      : t === 'bubble'
        ? '1px solid #F4C7A5'
        : 'none';
    const radius = node.cornerRadius ?? (t === 'bubble' ? '16px' : '0');
    const pad = node.paddingAll ?? (t === 'bubble' ? '14px' : '0');
    const kids = (node.contents ?? []).map((c) => renderNode(c)).join('');
    const body = node.body ? renderNode(node.body) : kids;
    const footer = node.footer
      ? `<div style="margin-top:8px">${renderNode(node.footer)}</div>`
      : '';
    return `<div style="display:flex;flex-direction:${layout};gap:6px;background:${bg};border:${border};border-radius:${radius};padding:${pad};min-width:0;max-width:100%;box-sizing:border-box;overflow:hidden">${body}${footer}</div>`;
  }
  if (Array.isArray(node.contents)) {
    return node.contents.map((c) => renderNode(c)).join('');
  }
  return '';
}

const sections = REFILL_EXCHANGE_PREVIEW_STATES.map((state) => {
  const msgs = buildRefillExchangePreviewMessages(state);
  const flex = msgs.find((m) => m.type === 'flex');
  if (!flex || flex.type !== 'flex') throw new Error(`missing flex for ${state}`);
  const html = renderNode(flex.contents as FlexNode);
  return `
  <section data-state="${state}" style="margin:24px 0">
    <h2 style="font-size:16px">${REFILL_EXCHANGE_PREVIEW_STATE_LABELS[state]} <code>?state=${state}</code></h2>
    <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start">
      <div>
        <div style="font-size:12px;margin-bottom:6px">桌面 420px</div>
        <div style="width:420px;max-width:100%;background:#EFEAE4;border:1px solid #ccc;border-radius:24px;padding:12px;box-sizing:border-box;overflow:hidden">${html}</div>
      </div>
      <div>
        <div style="font-size:12px;margin-bottom:6px">手機 320px</div>
        <div style="width:320px;max-width:100%;background:#EFEAE4;border:1px solid #ccc;border-radius:24px;padding:12px;box-sizing:border-box;overflow:hidden">${html}</div>
      </div>
    </div>
  </section>`;
}).join('\n');

const page = `<!doctype html><html><head><meta charset="utf-8"/><title>換購期限 Preview QA</title>
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;padding:20px;background:#fafafa;color:#222} code{background:#eee;padding:2px 6px;border-radius:4px}</style>
</head><body>
<h1>換購期限 LINE Flex 視覺驗收（靜態）</h1>
<p><strong>Preview／尚未上線</strong> — 由 builder JSON 渲染，非 live push。</p>
${sections}
</body></html>`;

writeFileSync('/opt/cursor/artifacts/refill-exchange-preview/qa.html', page);
console.log('wrote /opt/cursor/artifacts/refill-exchange-preview/qa.html');

for (const state of REFILL_EXCHANGE_PREVIEW_STATES) {
  const raw = JSON.stringify(buildRefillExchangePreviewMessages(state));
  console.log(
    JSON.stringify({
      state,
      has30Text: raw.includes('"text":"30 天內"'),
      hasXl: raw.includes('"size":"xl"'),
      hasBold: raw.includes('"weight":"bold"'),
      hasPreviewBadge: raw.includes('尚未接 live'),
      hasLongStore: raw.includes('板橋文化路長名稱驗收分店'),
      hasDateSlash: /最後使用日：\d{4}\/\d{2}\/\d{2}/.test(raw),
    }),
  );
}
