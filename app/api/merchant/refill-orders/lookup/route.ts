import { NextResponse } from 'next/server';
import { requireRefillMerchantSession } from '@/lib/refill/auth-merchant';
import {
  listMerchantRefillOrders,
  lookupRefillByOrderId,
} from '@/lib/refill/merchant';
import { toRefillHttp } from '@/lib/refill/errors';
import { RefillError } from '@/lib/refill/errors';
import { formatRefillOrderNo, parseRefillLookupQuery } from '@/lib/pos/refill-view';
import { legacyMerchantSerialFlowResult } from '@/lib/refill/legacy-merchant-flow';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await requireRefillMerchantSession();
    const body = (await req.json()) as { serial?: string; query?: string };
    const raw = body.query ?? body.serial ?? '';
    const parsed = parseRefillLookupQuery(raw);

    if (parsed.kind === 'serial') {
      const result = legacyMerchantSerialFlowResult();
      return NextResponse.json(result.body, {
        status: result.status,
        headers: result.headers,
      });
    }

    if (parsed.kind === 'id') {
      const result = await lookupRefillByOrderId(session.merchantId, parsed.value);
      return NextResponse.json(result);
    }

    if (parsed.kind === 'display') {
      const orders = await listMerchantRefillOrders(session.merchantId);
      const match = orders.find((order) => {
        const no = formatRefillOrderNo(order.id, order.createdAt).replace(/^#/, '');
        return no === parsed.value.replace(/^#/, '');
      });
      if (!match) {
        throw new RefillError('找不到這個罐子的換罐資料', 'ORDER_NOT_FOUND', 404);
      }
      const result = await lookupRefillByOrderId(session.merchantId, match.id);
      return NextResponse.json(result);
    }

    throw new RefillError('找不到這個罐子的換罐資料', 'INVALID_SERIAL', 400);
  } catch (e) {
    const { status, body } = toRefillHttp(e);
    return NextResponse.json(body, { status });
  }
}
