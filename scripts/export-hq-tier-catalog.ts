import { prisma } from '../lib/prisma';

async function main() {
  const products = await prisma.product.findMany({
    where: { status: 'active', productCategory: 'STANDARD' },
    orderBy: [{ name: 'asc' }, { productId: 'asc' }],
    select: {
      id: true,
      productId: true,
      name: true,
      sku: true,
      sourceSku: true,
      unit: true,
      price: true,
      defaultTemperature: true,
      priceTiers: {
        where: { status: 'active' },
        orderBy: [{ weightGrams: 'asc' }, { unitQty: 'asc' }, { price: 'asc' }],
        select: {
          id: true,
          weightGrams: true,
          unit: true,
          unitQty: true,
          price: true,
          sku: true,
          shopifySku: true,
          shopifyVariantId: true,
          status: true,
        },
      },
    },
  });

  console.log(JSON.stringify({
    ok: true,
    count: products.length,
    products: products.map(p => ({
      id: p.id,
      productId: p.productId,
      name: p.name,
      sku: p.sku,
      sourceSku: p.sourceSku,
      unit: p.unit,
      price: p.price,
      defaultTemperature: p.defaultTemperature,
      tiers: p.priceTiers,
    })),
  }));
}

main()
  .catch(error => {
    console.error('[HQ_TIER_EXPORT_FAILED]', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
