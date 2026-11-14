// Read-only source verification. Does NOT write Shopify, database, or start a cron.
import { readFile, writeFile } from 'node:fs/promises';
import { parseList, parseAnimal, planChanges, sourceUrl } from '../lib/adoption/source-sync.mjs';

const args = process.argv.slice(2);
function option(name, fallback) { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; }
const limit = Number(option('--limit', '10'));
if (!Number.isInteger(limit) || limit < 1 || limit > 250) throw new Error('--limit must be 1..250');
const previous = JSON.parse(await readFile(option('--previous', '/dev/null'), 'utf8').catch(() => '[]') || '[]');
async function get(url) {
  sourceUrl(url);
  const r = await fetch(url, { redirect: 'error', headers: { 'User-Agent': 'Furmosa-AdoptionSync/0.1 (+https://furmosa.com)' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  if (!r.headers.get('content-type')?.includes('text/html')) throw new Error('Unexpected content type');
  return r.text();
}
const pending = ['https://www.loverabbit.org/products/1/1', 'https://www.loverabbit.org/products/5/1'];
const visited = new Set(), ids = new Set(), errors = [], current = [], failedIds = [];
while (pending.length) {
  const url = pending.shift();
  if (visited.has(url)) continue;
  if (visited.size >= 30) { errors.push({ url, error: 'Pagination cap reached' }); break; }
  visited.add(url);
  try { const page = parseList(await get(url), url); page.ids.forEach(id => ids.add(id)); page.pages.forEach(p => { if (!visited.has(p) && !pending.includes(p)) pending.push(p); }); }
  catch (e) { errors.push({ url, error: e.message }); }
  await new Promise(r => setTimeout(r, 1000));
}
for (const id of [...ids].slice(0, limit)) {
  try { current.push(parseAnimal(await get(`https://www.loverabbit.org/products_detail/${id}`), id)); }
  catch (e) { failedIds.push(id); errors.push({ id, error: e.message }); }
  await new Promise(r => setTimeout(r, 1000));
}
const complete = errors.length === 0 && ids.size > 0 && current.length === ids.size;
const result = { mode: 'read-only', checkedAt: new Date().toISOString(), pages: visited.size, discovered: ids.size, parsed: current.length, errors, ...planChanges(previous, current, { complete, failedIds }) };
const output = option('--output', null);
if (output) await writeFile(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, changes: result.changes.map(({ id, action }) => ({ id, action })) }, null, 2));
if (!complete) process.exitCode = 2;
