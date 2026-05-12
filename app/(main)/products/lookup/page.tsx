import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import { Search, DollarSign, Building2, Scale, Package, ArrowUpRight } from 'lucide-react';
import { LookupForm } from './lookup-form';

export const dynamic = 'force-dynamic';

export default async function ProductLookupPage({
  searchParams,
}: {
  searchParams?: { q?: string; weight?: string };
}) {
  const q = (searchParams?.q ?? '').trim();
  const weight = searchParams?.weight ? Number(searchParams.weight) : null;

  // 抓所有商品 + tiers 給 lookup form 用作 autocomplete
  const allProducts = await prisma.product.findMany({
    where: { status: { not: 'inactive' } },
    select: {
      id: true,
      name: true,
      sourceSku: true,
      sku: true,
    },
    orderBy: { name: 'asc' },
  });

  // 搜尋邏輯：如果有 q，按名稱模糊比對
  let results: Awaited<ReturnType<typeof queryResults>> = [];
  if (q) {
    results = await queryResults(q, weight);
  }

  return (
    <>
      <PageHeader
        title="價格查詢"
        description="輸入商品名稱（或單價表 SKU）+ 重量，立即查詢售價、cost、毛利、廠商"
      />
      <div className="grid gap-6 p-6">
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4 text-info" />
                查詢條件
            </span>
          }
          description="輸入關鍵字（如「雞肉南瓜」「FD-04」），可選重量篩選"
        >
          <LookupForm
            defaultQuery={q}
            defaultWeight={weight}
            allProducts={allProducts}
          />
        </SectionCard>

        {q && (
          <SectionCard
            title={`搜尋結果（${results.length}）`}
            description={
              weight
                ? `關鍵字「${q}」+ 重量 ${weight}g`
                : `關鍵字「${q}」（所有規格）`
            }
          >
            {results.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center text-sm text-muted-foreground">
                沒找到符合的商品 / 規格。可試試別的關鍵字，或查看
                <Link href="/products" className="ml-1 text-primary hover:underline">
                  所有商品
                </Link>
                。
              </div>
            ) : (
              <div className="grid gap-4">
                {results.map((r) => (
                  <ResultCard key={`${r.product.id}-${r.tier?.id ?? 'no-tier'}`} {...r} />
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {!q && (
          <SectionCard
            title="使用方式"
            description="可在這頁用名稱或 SKU 找對應的商品價格"
          >
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <Tip
                icon={<Search className="h-4 w-4 text-info" />}
                title="名稱模糊比對"
                desc="輸入「雞肉」會列出所有含此關鍵字的商品。"
              />
              <Tip
                icon={<Scale className="h-4 w-4 text-warning" />}
                title="按重量篩"
                desc="同一商品有 30g/50g/100g 規格，選後只顯示該尺寸。"
              />
              <Tip
                icon={<DollarSign className="h-4 w-4 text-success" />}
                title="毛利估算"
                desc="會自動算每個規格的售價、單位 g 價、毛利。"
              />
            </div>
          </SectionCard>
        )}
      </div>
    </>
  );
}

async function queryResults(q: string, weight: number | null) {
  // 先用名稱 / sourceSku / sku LIKE 找 product
  const matchingProducts = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: q } },
        { sourceSku: { contains: q } },
        { sku: { contains: q } },
      ],
    },
    include: {
      vendor: true,
      priceTiers: {
        where: weight ? { weightGrams: weight } : undefined,
        orderBy: [{ weightGrams: 'asc' }, { unitQty: 'asc' }],
      },
    },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    take: 50,
  });

  const out: Array<{
    product: (typeof matchingProducts)[number];
    tier: (typeof matchingProducts)[number]['priceTiers'][number] | null;
  }> = [];

  for (const p of matchingProducts) {
    if (p.priceTiers.length === 0) {
      // 沒有 tier 也顯示一張卡（讓使用者知道商品存在但沒價）
      if (!weight) out.push({ product: p, tier: null });
    } else {
      for (const tier of p.priceTiers) {
        out.push({ product: p, tier });
      }
    }
  }
  return out;
}

function ResultCard({
  product,
  tier,
}: {
  product: {
    id: string;
    name: string;
    productId: string;
    sku: string;
    sourceSku: string | null;
    cost: number;
    unit: string;
    style: string | null;
    notes: string | null;
    status: string;
    vendor: { id: string; name: string; vendorId: string } | null;
  };
  tier: {
    id: string;
    weightGrams: number | null;
    unit: string;
    unitQty: number;
    price: number;
    notes: string | null;
  } | null;
}) {
  const tierLabel = tier
    ? tier.weightGrams
      ? `${tier.weightGrams}g`
      : `${tier.unitQty} ${tier.unit}`
    : '尚無價格';
  const perGram =
    tier && tier.weightGrams && tier.weightGrams > 0 ? tier.price / tier.weightGrams : null;
  const tierMargin =
    tier && Number(product.cost) > 0 && tier.weightGrams
      ? tier.price - Number(product.cost) * tier.weightGrams
      : null;

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm hover:border-primary/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <Link
              href={`/products/${product.id}`}
              className="text-base font-semibold hover:underline"
            >
              {product.name}
            </Link>
            {product.sourceSku && (
              <Badge variant="secondary" className="font-mono text-xs">
                {product.sourceSku}
              </Badge>
            )}
            {product.style && (
              <Badge variant="info" className="text-xs">
                {product.style}
              </Badge>
            )}
            {product.status === 'inactive' && (
              <Badge variant="muted" className="text-xs">
                停售
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="font-mono">{product.productId}</span>
            <span>計價單位：{product.unit}</span>
            {product.vendor && (
              <Link
                href={`/vendors/${product.vendor.id}`}
                className="flex items-center gap-1 text-foreground hover:underline"
              >
                <Building2 className="h-3.5 w-3.5" />
                {product.vendor.name}
              </Link>
            )}
          </div>
          {product.notes && (
            <div className="mt-2 text-xs text-muted-foreground line-clamp-2">{product.notes}</div>
          )}
        </div>

        {tier ? (
          <div className="flex flex-col items-end gap-1 rounded-lg border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Scale className="h-3 w-3" />
              {tierLabel}
              {tier.notes && <span className="ml-1 text-info">· {tier.notes}</span>}
            </div>
            <div className="text-2xl font-bold tabular-nums">{formatCurrency(tier.price)}</div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {perGram !== null && <span>{perGram.toFixed(2)} /g</span>}
              {Number(product.cost) > 0 && <span>cost {product.cost} /{product.unit}</span>}
              {tierMargin !== null && (
                <span className="text-success">毛利 {formatCurrency(tierMargin)}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
            尚無價格
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end">
        <Link
          href={`/products/${product.id}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          看完整商品資料
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function Tip({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2 font-medium">
        {icon}
        {title}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
    </div>
  );
}
