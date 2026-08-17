/**
 * 安全 XML／RSS／Atom 解析：禁 XXE／DOCTYPE／external entity，限制深度／節點／文字長度。
 * 不使用會展開 entity 的 DOM parser；純正則／狀態機抽取必要欄位。
 */

export type ParsedFeedItem = {
  title: string;
  summary: string;
  link: string;
  publishedAtRaw: string | null;
};

export type XmlParseResult =
  | { ok: true; items: ParsedFeedItem[] }
  | { ok: false; reason: string };

const MAX_NODES = 2_000;
const MAX_DEPTH = 32;
const MAX_TEXT = 2_000;
const MAX_ITEMS = 50;

function stripDangerous(xml: string): { ok: true; xml: string } | { ok: false; reason: string } {
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml) || /SYSTEM\s+["']/i.test(xml)) {
    return { ok: false, reason: 'doctype_or_entity_forbidden' };
  }
  if (/<\?xml-stylesheet/i.test(xml)) {
    return { ok: false, reason: 'stylesheet_forbidden' };
  }
  return { ok: true, xml };
}

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** 移除所有 HTML tags（絕不保留 markup）；script/style 連同內容一併刪除 */
export function stripHtml(input: string): string {
  return decodeBasicEntities(input)
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT);
}

function tagContent(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i');
  const m = block.match(re);
  if (!m?.[1]) return null;
  let inner = m[1].trim();
  const cdata = inner.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata?.[1] != null) inner = cdata[1];
  return stripHtml(inner);
}

function attrContent(block: string, tag: string, attr: string): string | null {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["'][^>]*/?>`, 'i');
  const m = block.match(re);
  return m?.[1] ? stripHtml(m[1]) : null;
}

function countDepth(xml: string): number {
  let depth = 0;
  let max = 0;
  const re = /<\/?([A-Za-z0-9:_-]+)[^>]*>/g;
  let m: RegExpExecArray | null;
  let nodes = 0;
  while ((m = re.exec(xml))) {
    nodes += 1;
    if (nodes > MAX_NODES) return Number.POSITIVE_INFINITY;
    const full = m[0];
    if (full.startsWith('</')) depth = Math.max(0, depth - 1);
    else if (!full.endsWith('/>') && !full.startsWith('<?') && !full.startsWith('<!')) {
      depth += 1;
      max = Math.max(max, depth);
    }
  }
  return max;
}

export function parseRssOrAtomSafe(xmlRaw: string): XmlParseResult {
  const cleaned = stripDangerous(xmlRaw);
  if (!cleaned.ok) return cleaned;
  const xml = cleaned.xml;
  if (countDepth(xml) > MAX_DEPTH) {
    return { ok: false, reason: 'xml_too_deep' };
  }

  const items: ParsedFeedItem[] = [];
  const itemBlocks = [
    ...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi),
    ...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi),
  ];

  for (const match of itemBlocks.slice(0, MAX_ITEMS)) {
    const block = match[1] ?? '';
    const title = tagContent(block, 'title') ?? '';
    const summary =
      tagContent(block, 'description') ??
      tagContent(block, 'summary') ??
      tagContent(block, 'content') ??
      '';
    const link =
      tagContent(block, 'link') ??
      attrContent(block, 'link', 'href') ??
      tagContent(block, 'guid') ??
      tagContent(block, 'id') ??
      '';
    const publishedAtRaw =
      tagContent(block, 'pubDate') ??
      tagContent(block, 'published') ??
      tagContent(block, 'updated') ??
      tagContent(block, 'dc:date') ??
      null;

    if (!title && !link) continue;
    items.push({
      title: title.slice(0, MAX_TEXT),
      summary: summary.slice(0, MAX_TEXT),
      link: link.slice(0, MAX_TEXT),
      publishedAtRaw,
    });
  }

  return { ok: true, items };
}

export function parseJsonFeedSafe(raw: string): XmlParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'malformed_json' };
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, reason: 'malformed_json' };
  }
  const itemsRaw = (data as { items?: unknown }).items;
  if (!Array.isArray(itemsRaw)) {
    return { ok: false, reason: 'malformed_json' };
  }
  const items: ParsedFeedItem[] = [];
  for (const it of itemsRaw.slice(0, MAX_ITEMS)) {
    if (!it || typeof it !== 'object') continue;
    const o = it as Record<string, unknown>;
    items.push({
      title: stripHtml(String(o.title ?? '')).slice(0, MAX_TEXT),
      summary: stripHtml(String(o.summary ?? o.content_text ?? '')).slice(0, MAX_TEXT),
      link: stripHtml(String(o.url ?? o.external_url ?? '')).slice(0, MAX_TEXT),
      publishedAtRaw: o.date_published ? String(o.date_published) : null,
    });
  }
  return { ok: true, items };
}
