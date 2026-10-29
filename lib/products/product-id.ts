type ProductIdDb = {
  product: {
    findMany(args: {
      where: { productId: { startsWith: string } };
      select: { productId: true };
    }): Promise<Array<{ productId: string }>>;
  };
};

const pad = (value: number) => String(value).padStart(4, '0');

export async function allocateNextProductIdentity(db: ProductIdDb) {
  const products = await db.product.findMany({
    where: { productId: { startsWith: 'PROD-' } },
    select: { productId: true },
  });
  const highest = products.reduce((current, product) => {
    const sequence = Number(product.productId.slice('PROD-'.length));
    return Number.isSafeInteger(sequence) ? Math.max(current, sequence) : current;
  }, 0);
  const sequence = highest + 1;
  return { productId: `PROD-${pad(sequence)}`, sku: `FUR-${pad(sequence)}` };
}
