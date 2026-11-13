import { createHash } from 'node:crypto';
import { text } from './source-sync.mjs';

const ORIGIN = 'https://www.meetpets.org.tw';
export function meetpetsUrl(value) {
  const u = new URL(value, ORIGIN);
  if (u.origin !== ORIGIN || u.username || u.password || u.hash || !/^\/(?:content\/\d+|pets\/(?:dog|cat|others))$/.test(u.pathname) || [...u.searchParams].some(([k,v]) => k !== 'page' || !/^\d{1,2}$/.test(v))) throw new Error('Unsupported Meetpets URL');
  return u.href;
}
// Balanced div extraction keeps neighbouring fields, navigation and contacts out.
function div(html, className) {
  const tags = /<\/?div\b[^>]*>/gi;
  let match;
  while ((match = tags.exec(html))) {
    const classes = match[0].match(/class=["']([^"']+)["']/i)?.[1].split(/\s+/) || [];
    if (!classes.includes(className)) continue;
    const start = tags.lastIndex;
    let depth = 1, end;
    while ((end = tags.exec(html))) {
      depth += /^<\/div/i.test(end[0]) ? -1 : 1;
      if (!depth) return html.slice(start, end.index);
    }
    throw new Error('Incomplete Meetpets markup');
  }
  return '';
}
const field = (html, name) => text(div(html, 'field-field-' + name)).replace(/^[^:：]{1,40}[:：]\s*/, '').trim();
const publicText = value => value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '（聯絡請見原頁）').replace(/(?:\+886[-\s]?|0)9\d{2}[-\s]?\d{3}[-\s]?\d{3}/g, '（聯絡請見原頁）');
export function parseMeetpetsList(html, url) {
  const u = new URL(meetpetsUrl(url));
  const category = u.pathname.split('/')[2];
  const block = div(html, 'view-content-pets-' + category);
  if (!block) throw new Error('Meetpets animal list missing; preserve previous data');
  const ids = [...new Set([...block.matchAll(/href=["']\/content\/(\d+)["']/g)].map(m=>m[1]))];
  const pages = [...new Set([...html.matchAll(/href=["']([^"']*\?page=\d+)["']/g)].map(m=>meetpetsUrl(m[1].replace(/&amp;/g,'&'))).filter(v=>new URL(v).pathname===u.pathname))];
  return { ids, pages };
}
export function parseMeetpetsAnimal(html, id) {
  if (!new RegExp(`\\bid=["']node-${id}["']`).test(html) || !/\btype_pets\b/.test(html)) throw new Error('Meetpets animal identity missing');
  const node = div(html, 'node');
  const title = text(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const speciesText = field(node, 'pets-type');
  const name = field(node, 'pet-name') || title;
  const region = field(node, 'county');
  if (!title || !name || !speciesText || !region) throw new Error('Meetpets required animal fields missing');
  const closed = /已送出|已送養|已認養|找到家|已找到|停止送養|暫停送養/.test(title);
  const photos = [...new Set([...div(node,'field-field-pets-image').matchAll(/\bsrc=["']([^"']+)["']/g)].map(m=>new URL(m[1],ORIGIN).href).filter(v=>v.startsWith(ORIGIN+'/files_meetpets/')))];
  const behavior = publicText(field(node,'pet-habitate'));
  const requirements = publicText(field(node,'pet-limitation'));
  const story = publicText(field(node,'limitation-desc'));
  const basic = [speciesText, region, field(node,'pet-age'), '結紮情況：'+(field(node,'pet-medical')||'未提供')].filter(Boolean);
  const record = {id:String(id),url:meetpetsUrl('/content/'+id),name,title,region,species:/狗/.test(speciesText)?'dog':/貓/.test(speciesText)?'cat':/兔/.test(speciesText)?'rabbit':/天竺鼠/.test(speciesText)?'guinea':/鼠/.test(speciesText)?'hamster':'other',status:closed?'已送養':'已開放領養',photos,basic,description:[publicText(field(node,'pet-look')),behavior,story,requirements && '原刊登者認養條件：'+requirements].filter(Boolean).join('\n\n'),behavior:behavior?[behavior]:[],medical:[],requirements};
  return {...record,hash:createHash('sha256').update(JSON.stringify(record)).digest('hex')};
}
export const meetpetsAdapter = {
  id:'meetpets', sourceUrl:meetpetsUrl,
  orderDirection:'desc',
  seeds:['others','dog','cat'].map(s=>ORIGIN+'/pets/'+s),
  parseList:parseMeetpetsList, parseAnimal:parseMeetpetsAnimal,
  regionForList:()=>'', detailUrl:id=>meetpetsUrl('/content/'+id),
  displayAnimal:a=>({...a,image:a.photos[0]||'',basic:a.basic.join(' · '),note:'刊登中的認養訊息，實際狀態請向原刊登者確認'}),
};
