/**
 * Back-compat wrappers for refill callers. Prefer `@/lib/liff/vercel-share-fetch`.
 */

export {
  isSameOriginLiffApiPath as isSameOriginRefillApiPath,
  liffPreviewFetch as liffRefillFetch,
  readVercelShareFromPageUrl,
  resolveLiffPreviewFetchUrl as resolveLiffRefillFetchUrl,
} from '@/lib/liff/vercel-share-fetch';
