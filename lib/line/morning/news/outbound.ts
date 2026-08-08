/**
 * Outbound 安全擷取（Preview 框架）。
 * 本階段所有 registry 來源 enabled=false → fetchAllowlistedUrl 會拒絕。
 */

import dns from 'node:dns/promises';
import net from 'node:net';
import { findSourceByHost, getSourceById } from '@/lib/line/morning/news/registry';

export const OUTBOUND_TIMEOUT_MS = 5_000;
export const OUTBOUND_MAX_BYTES = 1 * 1024 * 1024;
export const OUTBOUND_MAX_REDIRECTS = 2;

const ALLOWED_CONTENT_TYPES = [
  'application/rss+xml',
  'application/atom+xml',
  'application/xml',
  'text/xml',
  'application/json',
  'text/json',
];

export type OutboundDenyReason =
  | 'bad_scheme'
  | 'credentials_in_url'
  | 'host_not_allowlisted'
  | 'path_not_allowlisted'
  | 'source_disabled'
  | 'private_ip'
  | 'dns_failed'
  | 'redirect_exceeded'
  | 'timeout'
  | 'oversize'
  | 'bad_mime'
  | 'fetch_failed';

export type OutboundOk = {
  ok: true;
  finalUrl: string;
  contentType: string;
  body: string;
  bytes: number;
};

export type OutboundErr = {
  ok: false;
  reason: OutboundDenyReason;
  detail?: string;
};

function isPrivateOrReservedIp(ip: string): boolean {
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return true;
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) return true;
  // IPv4-mapped IPv6
  if (ip.toLowerCase().startsWith('::ffff:')) {
    return isPrivateOrReservedIp(ip.slice(7));
  }
  if (!net.isIP(ip)) return true;
  if (net.isIPv6(ip)) {
    // block unique local / link-local already handled; block unspecified
    if (ip === '::' || ip.startsWith('64:ff9b:')) return true;
    return false;
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local / metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

export function classifyIpForSsrf(ip: string): 'ok' | 'blocked' {
  return isPrivateOrReservedIp(ip) ? 'blocked' : 'ok';
}

export type UrlValidationOk = {
  ok: true;
  url: URL;
  sourceId: string;
};

export async function validateOutboundUrl(
  rawUrl: string,
  opts?: { requireEnabledSource?: boolean },
): Promise<UrlValidationOk | OutboundErr> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'bad_scheme', detail: 'invalid_url' };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'bad_scheme' };
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'credentials_in_url' };
  }

  const source = findSourceByHost(url.hostname);
  if (!source) {
    return { ok: false, reason: 'host_not_allowlisted' };
  }
  if (opts?.requireEnabledSource !== false && !source.enabled) {
    return { ok: false, reason: 'source_disabled', detail: source.sourceId };
  }
  if (source.feedPathAllowlist.length > 0) {
    const pathOk = source.feedPathAllowlist.some(
      (p) => url.pathname === p || url.pathname.startsWith(p.endsWith('/') ? p : `${p}`),
    );
    if (!pathOk) {
      return { ok: false, reason: 'path_not_allowlisted' };
    }
  }

  try {
    const records = await dns.lookup(url.hostname, { all: true, verbatim: true });
    if (!records.length) return { ok: false, reason: 'dns_failed' };
    for (const r of records) {
      if (classifyIpForSsrf(r.address) === 'blocked') {
        return { ok: false, reason: 'private_ip', detail: r.address };
      }
    }
  } catch {
    return { ok: false, reason: 'dns_failed' };
  }

  return { ok: true, url, sourceId: source.sourceId };
}

function contentTypeAllowed(ct: string | null): boolean {
  if (!ct) return false;
  const base = ct.split(';')[0]?.trim().toLowerCase() ?? '';
  return ALLOWED_CONTENT_TYPES.includes(base);
}

/**
 * 安全 fetch。本階段因 enabled=false，正常路徑會在 validate 失敗。
 * 測試可傳 requireEnabledSource:false 並注入 fetchImpl。
 */
export async function fetchAllowlistedUrl(
  rawUrl: string,
  opts?: {
    requireEnabledSource?: boolean;
    maxRedirects?: number;
    fetchImpl?: typeof fetch;
    sourceIdHint?: string;
  },
): Promise<OutboundOk | OutboundErr> {
  if (opts?.sourceIdHint) {
    const src = getSourceById(opts.sourceIdHint);
    if (opts.requireEnabledSource !== false && !src?.enabled) {
      return { ok: false, reason: 'source_disabled', detail: opts.sourceIdHint };
    }
  }

  let current = rawUrl;
  const maxRedirects = opts?.maxRedirects ?? OUTBOUND_MAX_REDIRECTS;
  const fetchImpl = opts?.fetchImpl ?? fetch;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const validated = await validateOutboundUrl(current, {
      requireEnabledSource: opts?.requireEnabledSource,
    });
    if (!validated.ok) return validated;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OUTBOUND_TIMEOUT_MS);
    try {
      const res = await fetchImpl(validated.url.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'application/rss+xml, application/atom+xml, application/xml, application/json',
          'User-Agent': 'FurmosaMorningPreviewBot/0.1 (+preview-only; no-live-default)',
        },
      });

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get('location');
        if (!loc) return { ok: false, reason: 'fetch_failed', detail: 'redirect_no_location' };
        if (hop >= maxRedirects) {
          return { ok: false, reason: 'redirect_exceeded' };
        }
        current = new URL(loc, validated.url).toString();
        continue;
      }

      if (!res.ok) {
        return { ok: false, reason: 'fetch_failed', detail: `status_${res.status}` };
      }

      const ct = res.headers.get('content-type');
      if (!contentTypeAllowed(ct)) {
        return { ok: false, reason: 'bad_mime', detail: ct ?? 'missing' };
      }

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > OUTBOUND_MAX_BYTES) {
        return { ok: false, reason: 'oversize', detail: String(buf.byteLength) };
      }

      return {
        ok: true,
        finalUrl: validated.url.toString(),
        contentType: ct?.split(';')[0]?.trim().toLowerCase() ?? '',
        body: buf.toString('utf8'),
        bytes: buf.byteLength,
      };
    } catch (e) {
      const name = e instanceof Error ? e.name : '';
      if (name === 'AbortError') return { ok: false, reason: 'timeout' };
      return {
        ok: false,
        reason: 'fetch_failed',
        detail: e instanceof Error ? e.message.slice(0, 80) : 'error',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, reason: 'redirect_exceeded' };
}

export function redactOutboundError(err: OutboundErr): { reason: OutboundDenyReason } {
  // 不回傳完整 URL／IP／payload
  return { reason: err.reason };
}
