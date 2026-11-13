const allowedOrigins = new Set(['https://furmosa.com', 'https://www.furmosa.com']);

export function adoptionHeaders(origin: string | null) {
  return {
    'Cache-Control': 'public, max-age=30, s-maxage=60',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
    ...(origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
  };
}

/** Explicit public field allowlist. Never serialize database rows or errors. */
export function publicAnimal(row: { data: unknown; lastCheckedAt: Date | null; sourceStatus: string }) {
  const data = row.data as Record<string, unknown>;
  const scalar = (key: string) => typeof data[key] === 'string' ? data[key] as string : '';
  const list = (key: string) => Array.isArray(data[key]) ? (data[key] as unknown[]).filter((v): v is string => typeof v === 'string') : [];
  return {
    id: scalar('id'), url: scalar('url'), name: scalar('name'), status: row.sourceStatus,
    region: scalar('region'), species: scalar('species'), image: scalar('image'),
    basic: scalar('basic'), note: scalar('note'), description: scalar('description'),
    behavior: list('behavior'), medical: list('medical'), checkedAt: row.lastCheckedAt?.toISOString() || null,
  };
}
