import Link from 'next/link';
import type { ReactNode } from 'react';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  customerSearchWhere,
  merchantSearchWhere,
  orderSearchWhere,
  productSearchWhere,
} from '@/lib/site-search';
import {
  loadSearchSection,
  normalizeGlobalSearchQuery,
  type SearchSectionState,
} from '@/lib/global-search';
import { omsSourceSearchWhere, workbenchVisibleWhere } from '@/lib/orders/oms-workbench';

export const dynamic = 'force-dynamic';

const RESULT_LIMIT = 8;

type ResultItem = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  meta?: string;
};

async function searchOrders(q: string): Promise<ResultItem[]> {
  const rows = await prisma.order.findMany({
    where: {
      AND: [
        workbenchVisibleWhere,
        { OR: [orderSearchWhere(q)!, omsSourceSearchWhere(q)] },
      ],
    },
    select: {
      id: true,
      orderNumber: true,
      externalOrderName: true,
      orderedAt: true,
      total: true,
      customer: { select: { name: true } },
      merchant: { select: { name: true } },
      items: { select: { productName: true }, take: 1 },
    },
    orderBy: [{ orderedAt: 'desc' }, { id: 'desc' }],
    take: RESULT_LIMIT,
  });

  return rows.map((row) => ({
    id: row.id,
    href: `/orders/${row.id}`,
    title: row.externalOrderName || row.orderNumber,
    subtitle: [row.customer?.name ?? row.merchant?.name, row.items[0]?.productName]
      .filter(Boolean)
      .join(' · ') || '訂單資料',
    meta: `${formatDate(row.orderedAt)} · ${formatCurrency(Number(row.total))}`,
  }));
}

async function searchCustomers(q: string): Promise<ResultItem[]> {
  const rows = await prisma.customer.findMany({
    where: customerSearchWhere(q),
    select: { id: true, customerId: true, name: true, phone: true, petName: true },
    orderBy: [{ lastOrderAt: 'desc' }, { customerId: 'asc' }],
    take: RESULT_LIMIT,
  });

  return rows.map((row) => ({
    id: row.id,
    href: `/customers/${row.id}`,
    title: row.name,
    subtitle: [row.customerId, row.phone].filter(Boolean).join(' · '),
    meta: row.petName ? `毛孩 ${row.petName}` : undefined,
  }));
}

async function searchMerchants(q: string): Promise<ResultItem[]> {
  const rows = await prisma.merchant.findMany({
    where: merchantSearchWhere(q),
    select: { id: true, merchantId: true, name: true, city: true, contactName: true },
    orderBy: [{ name: 'asc' }, { merchantId: 'asc' }],
    take: RESULT_LIMIT,
  });

  return rows.map((row) => ({
    id: row.id,
    href: `/merchants/${row.id}`,
    title: row.name,
    subtitle: [row.merchantId, row.city].filter(Boolean).join(' · '),
    meta: row.contactName ? `聯絡人 ${row.contactName}` : undefined,
  }));
}

async function searchProducts(q: string): Promise<ResultItem[]> {
  const rows = await prisma.product.findMany({
    where: productSearchWhere(q),
    select: { id: true, productId: true, name: true, sku: true, status: true },
    orderBy: [{ status: 'asc' }, { productId: 'asc' }],
    take: RESULT_LIMIT,
  });

  return rows.map((row) => ({
    id: row.id,
    href: `/products/${row.id}`,
    title: row.name,
    subtitle: [row.productId, row.sku].filter(Boolean).join(' · '),
    meta: row.status === 'active' ? '上架' : row.status === 'draft' ? '草稿' : '下架',
  }));
}

function ResultSection({
  title,
  state,
  allHref,
}: {
  title: string;
  state: SearchSectionState<ResultItem>;
  allHref: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b py-4">
        <CardTitle className="text-base">{title}</CardTitle>
        {state.status === 'ok' ? <Badge variant="secondary">{state.items.length}</Badge> : null}
      </CardHeader>
      <CardContent className="p-0">
        {state.status === 'error' ? (
          <p className="p-5 text-sm text-muted-foreground">此分類暫時載入失敗，其他結果仍可使用</p>
        ) : state.items.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">沒有符合資料</p>
        ) : (
          <div className="divide-y">
            {state.items.map((item) => (
              <Link key={item.id} href={item.href} className="block p-4 transition-colors hover:bg-muted/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{item.subtitle}</p>
                  </div>
                  {item.meta ? (
                    <span className="shrink-0 text-right text-xs text-muted-foreground">{item.meta}</span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
        {state.status === 'ok' && state.items.length > 0 ? (
          <Link href={allHref} className="block border-t px-4 py-3 text-sm font-medium text-info hover:bg-muted/50">
            查看此分類完整結果
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SearchLayout({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-2">{children}</div>;
}

export default async function GlobalSearchPage(props: {
  searchParams?: Promise<{ q?: string | string[] }>;
}) {
  const searchParams = await props.searchParams;
  const q = normalizeGlobalSearchQuery(searchParams?.q);

  if (!q) {
    return (
      <>
        <PageHeader title="搜尋" description="搜尋訂單、客戶、店家與商品" />
        <div className="p-6 text-sm text-muted-foreground">請在上方輸入關鍵字</div>
      </>
    );
  }

  const [orders, customers, merchants, products] = await Promise.all([
    loadSearchSection('orders', () => searchOrders(q)),
    loadSearchSection('customers', () => searchCustomers(q)),
    loadSearchSection('merchants', () => searchMerchants(q)),
    loadSearchSection('products', () => searchProducts(q)),
  ]);
  const encoded = encodeURIComponent(q);

  return (
    <>
      <PageHeader title={`搜尋「${q}」`} description="跨訂單、客戶、店家與商品" />
      <SearchLayout>
        <ResultSection title="訂單" state={orders} allHref={`/orders?q=${encoded}`} />
        <ResultSection title="客戶" state={customers} allHref={`/customers?q=${encoded}`} />
        <ResultSection title="店家" state={merchants} allHref={`/merchants?q=${encoded}`} />
        <ResultSection title="商品" state={products} allHref={`/products?q=${encoded}`} />
      </SearchLayout>
    </>
  );
}
