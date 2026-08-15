export const dynamic = 'force-dynamic';

const LIVENESS_BODY = { ok: true, service: 'furmosa-hq' } as const;
const LIVENESS_JSON = JSON.stringify(LIVENESS_BODY);

/**
 * Public liveness only. No auth, DB, Prisma, env, or network.
 * DB / schema / auth readiness is deferred until an authoritative
 * active-admin guard exists. Do not replace that with a public query.
 */
export function GET() {
  return new Response(LIVENESS_JSON, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });
}
