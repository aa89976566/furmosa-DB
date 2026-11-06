import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { markShipmentStatusFromQueue } from '@/app/(main)/shipments/actions';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store' },
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getCurrentUser()) return json({ ok: false, error: '請先登入 HQ' }, 401);
  const { id } = await params;
  if (new URL(_request.url).searchParams.get('diagnostic') === '1') {
    const shipment = await prisma.shipment.findUnique({
      where: { id },
      select: { id: true, status: true, order: { select: {
        id: true, omsStatus: true, omsReviewedAt: true, omsReviewedById: true,
        omsCheckedAt: true, omsCheckedSourceUpdatedAt: true, shopifySourceUpdatedAt: true,
        deletedAt: true, omsIssueFlags: true,
      } } },
    });
    if (!shipment) return json({ ok: false, error: '出貨單不存在' }, 404);
    const order = shipment.order;
    return json({ ok: true, shipmentId: shipment.id, status: shipment.status,
      diagnostic: order ? {
        orderId: order.id, omsStatus: order.omsStatus,
        reviewedAt: order.omsReviewedAt, reviewerRecorded: Boolean(order.omsReviewedById),
        checkedAt: order.omsCheckedAt, checkedSourceUpdatedAt: order.omsCheckedSourceUpdatedAt,
        sourceUpdatedAt: order.shopifySourceUpdatedAt, deleted: Boolean(order.deletedAt),
        issueFlagsValid: Array.isArray(order.omsIssueFlags),
        issues: Array.isArray(order.omsIssueFlags) ? order.omsIssueFlags.map(issue => {
          const flag: Record<string, unknown> = issue && typeof issue === 'object' && !Array.isArray(issue) ? issue : {};
          return { code: flag.code, severity: flag.severity, blocking: flag.blocking };
        }) : [],
      } : null,
    });
  }
  const shipment = await prisma.shipment.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!shipment) return json({ ok: false, error: '出貨單不存在' }, 404);
  return json({ ok: true, shipmentId: shipment.id, status: shipment.status });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getCurrentUser()) return json({ ok: false, error: '請先登入 HQ' }, 401);
  // JSON-only, same-origin browser requests retain Server Actions' CSRF boundary.
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host') || new URL(request.url).host;
  let sameOrigin = false;
  try { sameOrigin = Boolean(origin && new URL(origin).host === host); } catch { /* Reject malformed origins. */ }
  if (!sameOrigin || !request.headers.get('content-type')?.startsWith('application/json')) {
    return json({ ok: false, error: '不允許的請求來源' }, 403);
  }
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return json({ ok: false, error: '請求格式錯誤' }, 400); }
  if (!body || typeof body !== 'object' || !('next' in body) || typeof body.next !== 'string') {
    return json({ ok: false, error: '缺少出貨狀態' }, 400);
  }
  const formData = new FormData();
  formData.set('shipmentId', id);
  for (const field of ['next', 'carrier', 'trackingNumber', 'note'] as const) {
    if (field in body && typeof (body as Record<string, unknown>)[field] === 'string') {
      formData.set(field, (body as Record<string, string>)[field]);
    }
  }
  const result = await markShipmentStatusFromQueue(formData);
  return json(result, result.ok ? 200 : 409);
}
