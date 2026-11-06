export const PRODUCT_WISH_SPECIES = {
  dog: '狗狗',
  cat: '貓咪',
  rabbit: '兔兔',
  guinea_pig: '天竺鼠',
  hamster: '倉鼠',
  bird: '鳥類',
  reptile: '爬蟲',
  other: '其他小夥伴',
} as const;

export type ProductWishSpecies = keyof typeof PRODUCT_WISH_SPECIES;

export type ProductWishInput = {
  species: ProductWishSpecies;
  requestText: string;
  intent?: string;
};

export function parseProductWish(value: unknown):
  | { ok: true; value: ProductWishInput }
  | { ok: false; error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: '請填寫想找的東西' };
  }

  const body = value as Record<string, unknown>;
  const species = String(body.species ?? '').trim() as ProductWishSpecies;
  const requestText = String(body.requestText ?? '').trim();
  const intent = String(body.intent ?? '').trim();

  if (!(species in PRODUCT_WISH_SPECIES)) {
    return { ok: false, error: '請選擇毛孩種類' };
  }
  if (requestText.length < 2 || requestText.length > 280) {
    return { ok: false, error: '需求請填寫 2 到 280 個字' };
  }
  if (intent.length > 80) {
    return { ok: false, error: '需求類型格式不正確' };
  }

  return {
    ok: true,
    value: {
      species,
      requestText,
      ...(intent ? { intent } : {}),
    },
  };
}
