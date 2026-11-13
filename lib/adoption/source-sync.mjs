import { createHash } from 'node:crypto';

const ORIGIN = 'https://www.loverabbit.org';
const OPEN = new Set(['已開放領養', '限定資格領養']);
const CLOSED = new Set(['未開放領養', '幼兔不送養', '已送養', '已成功送養', '天使的家']);
export const text = (s = '') => s.replace(/<[^>]*>/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const attribute = (html, name) => html.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'))?.[1];
export function sourceUrl(value) {
  const u = new URL(value, ORIGIN);
  if (u.origin !== ORIGIN || !/^\/products(?:_detail\/\d+|\/(?:1|5)\/\d+)$/.test(u.pathname)) throw new Error('Unsupported source URL');
  return u.href;
}
export function parseList(html, url) {
  sourceUrl(url);
  const block = html.match(/<ul\b[^>]*class=["'][^"']*\bproduct-list\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1];
  if (!block) throw new Error('Animal list markup missing; no deletion decisions permitted');
  const ids = [...new Set([...block.matchAll(/href=["'][^"']*\/products_detail\/(\d+)["']/g)].map(m => m[1]))];
  // Some final pages contain only campaign cards, not animals. Recognize only
  // the known public campaign endpoints; never accept an arbitrary empty page.
  const links = [...block.matchAll(/href=["']([^"']+)["']/g)].map(m => new URL(m[1], ORIGIN));
  const campaignOnly = links.length > 0 && links.every(u => (u.origin === ORIGIN && /^\/(?:about|article_detail)\/\d+$/.test(u.pathname)) || u.href === 'http://web.rabbit.org.tw/fsys/Regular/Regular_Search.php');
  if (!ids.length && !campaignOnly) throw new Error('Empty source list; manual verification required');
  const root = new URL(url).pathname.split('/')[2];
  const pages = [...new Set([...html.matchAll(/href=["']([^"']*\/products\/(?:1|5)\/\d+)["']/g)].map(m => sourceUrl(m[1])).filter(u => new URL(u).pathname.split('/')[2] === root))];
  return { ids, pages: [...new Set([url, ...pages])] };
}
export function parseAnimal(html, id) {
  const info = html.match(/<div\b[^>]*class=["']products-info["'][^>]*>([\s\S]*?)<div\b[^>]*class=["']products-detail/i)?.[1];
  if (!info) throw new Error('Animal details markup missing');
  const name = text(info.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const status = text(info.match(/送養狀態[：:]([^<]+)/)?.[1]);
  if (!name || ![...OPEN, ...CLOSED].includes(status)) throw new Error('Unknown name/status; preserve previous record');
  const imageTags = [...info.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
  const photos = [...new Set(imageTags.map(tag => attribute(tag, 'data-src') || attribute(tag, 'src')).filter(Boolean).map(v => new URL(v, ORIGIN).href).filter(v => v.startsWith(ORIGIN + '/upload/')))];
  const basic = [...info.matchAll(/<div\b[^>]*class=["']product-text["'][^>]*>([\s\S]*?)<\/div>/gi)].map(m => text(m[1])).filter(v => !v.startsWith('送養狀態'));
  const description = text(html.match(/<article\b[^>]*itemprop=["']text["'][^>]*>([\s\S]*?)<\/article>/i)?.[1]);
  const record = { source: 'loverabbit', id: String(id), url: sourceUrl(`${ORIGIN}/products_detail/${id}`), name, status, photos, basic, description };
  return { ...record, hash: createHash('sha256').update(JSON.stringify(record)).digest('hex') };
}
export function planChanges(previous, current, { complete, failedIds = [], maxRemovalFraction = 0.2 } = {}) {
  const seen = new Map(current.map(a => [a.id, a]));
  const old = new Map(previous.map(a => [a.id, a]));
  const failed = new Set(failedIds);
  const missing = previous.filter(a => !seen.has(a.id) && !failed.has(a.id));
  const suspicious = previous.length >= 10 && missing.length / previous.length > maxRemovalFraction;
  const changes = current.map(a => ({ id: a.id, action: !OPEN.has(a.status) ? 'hide_explicit_status' : !old.has(a.id) ? 'add' : old.get(a.id).hash !== a.hash ? 'update' : 'unchanged', record: a }));
  for (const a of previous) {
    if (failed.has(a.id)) changes.push({ id: a.id, action: 'preserve_fetch_failed' });
    else if (!seen.has(a.id)) changes.push({ id: a.id, action: !complete || suspicious ? 'preserve_incomplete_scan' : 'verify_missing_direct_page' });
  }
  return { complete: Boolean(complete), suspicious, changes };
}
