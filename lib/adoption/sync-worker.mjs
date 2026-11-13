import { parseList, parseAnimal, sourceUrl } from './source-sync.mjs';

const defaultAdapter = { id: 'loverabbit', sourceUrl, parseList, parseAnimal, displayAnimal, seeds: ['https://www.loverabbit.org/products/1/1', 'https://www.loverabbit.org/products/5/1'], regionForList: url => new URL(url).pathname.split('/')[2] === '1' ? '台北愛兔之家' : '高雄愛兔之家', detailUrl: id => `https://www.loverabbit.org/products_detail/${id}` };
const OPEN = new Set(['已開放領養', '限定資格領養']);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const errorText = error => String(error?.message || error).replace(/https?:\/\/\S+/g, '[url]').slice(0, 180);

export function displayAnimal(record, region) {
  const basic = record.basic.join(' · ');
  const species = /天竺鼠/.test(basic) ? 'guinea' : /楓葉鼠|倉鼠|黃金鼠|沙鼠/.test(basic) ? 'hamster' : 'rabbit';
  return {
    id: record.id, url: record.url, name: record.name.split(/\s*[-－]\s*/)[0], status: record.status,
    region, species, image: record.photos[0] || '', photos: record.photos, basic,
    note: basic.match(/其[他它]備註\s*[：:]\s*(.*)/)?.[1] || '',
    // Preserve the source text without inventing personality/medical tags.
    description: record.description, behavior: [], medical: [],
  };
}

export async function fetchSource(url, fetcher = fetch, validateUrl = sourceUrl) {
  validateUrl(url);
  const response = await fetcher(url, {
    redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'User-Agent': 'Furmosa-AdoptionSync/1.0 (+https://furmosa.com)' },
  });
  if (!response.ok) { const e = new Error(`HTTP ${response.status}`); e.status = response.status; throw e; }
  if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('Unexpected content type');
  const body = await response.text();
  if (body.length > 2_000_000) throw new Error('Source page exceeds size limit');
  return body;
}

/** Bounded, restart-safe batch. Only callable from the server-side worker. */
export async function runAdoptionSync(db, options = {}) {
  if (!options.enabled) return { skipped: 'disabled' };
  const adapter = options.adapter || defaultAdapter;
  const SOURCE = adapter.id;
  const now = options.now || (() => new Date());
  const fetcher = options.fetcher || fetch;
  const pause = options.pause || delay;
  const batchSize = Math.max(1, Math.min(30, Number(options.batchSize) || 25));
  const started = now();
  const run = await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('furmosa:adoption-sync'))`;
    const active = await tx.adoptionSyncRun.findFirst({ where: { leaseKey: SOURCE } });
    if (active && active.leaseUntil > started) return null;
    if (active) await tx.adoptionSyncRun.update({ where: { id: active.id }, data: { status: 'expired', leaseKey: null, finishedAt: started } });
    const recent = await tx.adoptionSyncRun.findFirst({ where: { source: SOURCE }, orderBy: { startedAt: 'desc' } });
    if (recent && started - recent.startedAt < 240000) return null;
    return tx.adoptionSyncRun.create({ data: { source: SOURCE, origin: options.origin || 'scheduled', leaseKey: SOURCE, leaseUntil: new Date(+started + 540000), errors: [] } });
  });
  if (!run) return { skipped: 'busy_or_not_due' };
  const errors = [];
  let discovered = 0, checked = 0, changed = 0, listComplete = false;
  const keepLease = async () => {
    if (+now() - +started > 420000) throw new Error('Batch time budget exceeded');
    const held = await db.adoptionSyncRun.updateMany({ where: { id: run.id, leaseKey: SOURCE, status: 'running' }, data: { leaseUntil: new Date(+now() + 120000) } });
    if (held.count !== 1) throw new Error('Worker lease lost');
  };
  try {
    const lastList = await db.adoptionSyncRun.findFirst({ where: { source: SOURCE, listComplete: true, status: { in: ['success', 'partial'] } }, orderBy: { startedAt: 'desc' } });
    if (!lastList || +started - +lastList.startedAt >= 1800000) {
      const queue = [...adapter.seeds];
      const visited = new Set(), seen = new Map();
      let listFailed = false;
      while (queue.length) {
        await keepLease();
        const url = queue.shift();
        if (visited.has(url)) continue;
        if (visited.size >= 30) { listFailed = true; errors.push({ phase: 'list', error: 'Pagination limit' }); break; }
        visited.add(url);
        try {
          const page = adapter.parseList(await fetchSource(url, fetcher, adapter.sourceUrl), url);
          const region = adapter.regionForList(url);
          for (const id of page.ids) seen.set(id, region);
          for (const next of page.pages) if (!visited.has(next) && !queue.includes(next)) queue.push(next);
        } catch (error) { listFailed = true; errors.push({ phase: 'list', page: new URL(url).pathname, error: errorText(error) }); }
        await pause(750);
      }
      discovered = seen.size;
      listComplete = !listFailed && seen.size > 0;
      if (listComplete) {
        const existing = await db.adoptionSourceRecord.findMany({ where: { source: SOURCE }, select: { sourceId: true } });
        const missing = existing.filter(a => !seen.has(a.sourceId));
        const suspicious = existing.length >= 10 && missing.length / existing.length > 0.2;
        if (suspicious) errors.push({ phase: 'list', error: 'Large disappearance: automatic missing decisions suspended' });
        let staged = 0;
        for (const [sourceId, region] of seen) {
          if (staged++ % 10 === 0) await keepLease();
          await db.adoptionSourceRecord.upsert({ where: { source_sourceId: { source: SOURCE, sourceId } }, create: { source: SOURCE, sourceId, region, sourceUrl: adapter.detailUrl(sourceId), data: {}, lastSeenAt: started, nextCheckAt: started }, update: { region, lastSeenAt: started, missingCount: 0 } });
        }
        // Absence alone never means adopted. Give missing records direct-page priority.
        if (!suspicious) for (const a of missing) await db.adoptionSourceRecord.update({ where: { source_sourceId: { source: SOURCE, sourceId: a.sourceId } }, data: { missingCount: { increment: 1 }, nextCheckAt: started } });
      }
    }
    const due = await db.adoptionSourceRecord.findMany({ where: { source: SOURCE, nextCheckAt: { lte: started } }, orderBy: [{ nextCheckAt: 'asc' }, { sourceId: adapter.orderDirection || 'asc' }], take: batchSize });
    for (const old of due) {
      await keepLease();
      try {
        const animal = adapter.parseAnimal(await fetchSource(old.sourceUrl, fetcher, adapter.sourceUrl), old.sourceId);
        const data = adapter.displayAnimal(animal, old.region);
        const updated = old.contentHash !== animal.hash;
        await db.adoptionSourceRecord.update({ where: { id: old.id }, data: {
          data, sourceStatus: animal.status, published: OPEN.has(animal.status) && Boolean(data.image), contentHash: animal.hash,
          lastCheckedAt: now(), nextCheckAt: new Date(+now() + 3600000), consecutiveErrors: 0, lastError: null,
        } });
        checked++; if (updated) changed++;
      } catch (error) {
        const attempts = old.consecutiveErrors + 1;
        const gone = [404, 410].includes(error.status);
        // Two independently scheduled direct 404/410 checks pause the listing,
        // without claiming it was adopted. Transient/parse errors never hide it.
        const confirmedGone = gone && /^HTTP (404|410)$/.test(old.lastError || '') && attempts >= 2;
        await db.adoptionSourceRecord.update({ where: { id: old.id }, data: {
          consecutiveErrors: attempts, lastError: errorText(error),
          ...(confirmedGone ? { published: false, sourceStatus: '原頁已移除，待確認' } : {}),
          nextCheckAt: new Date(+now() + Math.min(3600000, 300000 * 2 ** Math.min(attempts, 3))),
        } });
        errors.push({ phase: 'detail', sourceId: old.sourceId, error: errorText(error) });
      }
      await pause(750);
    }
    const status = errors.length ? 'partial' : 'success';
    await db.adoptionSyncRun.update({ where: { id: run.id }, data: { status, leaseKey: null, leaseUntil: null, finishedAt: now(), listComplete, discovered, checked, changed, errors } });
    return { runId: run.id, status, listComplete, discovered, checked, changed, errorCount: errors.length };
  } catch (error) {
    errors.push({ phase: 'run', error: errorText(error) });
    await db.adoptionSyncRun.update({ where: { id: run.id }, data: { status: 'failed', leaseKey: null, leaseUntil: null, finishedAt: now(), errors } });
    return { runId: run.id, status: 'failed', errorCount: errors.length };
  }
}
