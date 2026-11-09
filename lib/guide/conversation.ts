export type Profile = {
  species: string | null;
  need: string | null;
  category: 'food' | 'toy' | 'care' | null;
  ageMonths: number | null;
  avoid: string[];
  requirements: string[];
};

export type Product = {
  id: string;
  title: string;
  url: string;
  available: boolean;
  verified: boolean;
  species: string[];
  needs: string[];
  category: 'food' | 'toy' | 'care';
  ingredients: string[] | null;
  minAgeMonths: number | null;
  maxAgeMonths: number | null;
  verifiedClaims: string[];
};

export type Understanding = {
  profile: Profile;
  clearAvoid: boolean;
  clearRequirements: boolean;
  medical: boolean;
  shopping: boolean;
};

export const emptyProfile = (): Profile => ({
  species: null, need: null, category: null, ageMonths: null, avoid: [], requirements: [],
});

export function validateUnderstanding(value: unknown): Understanding {
  if (!value || typeof value !== 'object') throw new Error('INVALID_UNDERSTANDING');
  const v = value as Understanding;
  const p = v.profile;
  if (!p || typeof p !== 'object' ||
      ![null, 'food', 'toy', 'care'].includes(p.category) ||
      ![p.species, p.need].every(x => x === null || (typeof x === 'string' && x.length > 0 && x.length <= 100)) ||
      !(p.ageMonths === null || (Number.isInteger(p.ageMonths) && p.ageMonths >= 0 && p.ageMonths <= 1200)) ||
      ![p.avoid, p.requirements].every(a => Array.isArray(a) && a.length <= 20 && a.every(x => typeof x === 'string' && x.length > 0 && x.length <= 80)) ||
      ![v.clearAvoid, v.clearRequirements, v.medical, v.shopping].every(x => typeof x === 'boolean')) {
    throw new Error('INVALID_UNDERSTANDING');
  }
  return v;
}

export function mergeProfile(previous: Profile, understanding: Understanding): Profile {
  const next = understanding.profile;
  const changedSpecies = next.species !== null && previous.species !== null && next.species !== previous.species;
  const base = changedSpecies ? emptyProfile() : previous;
  return {
    species: next.species ?? base.species,
    need: next.need ?? base.need,
    category: next.category ?? base.category,
    ageMonths: next.ageMonths ?? base.ageMonths,
    avoid: [...new Set([...(understanding.clearAvoid ? [] : base.avoid), ...next.avoid])],
    requirements: [...new Set([...(understanding.clearRequirements ? [] : base.requirements), ...next.requirements])],
  };
}

// Only reviewed, structured catalog facts enter this function. Never infer pet
// suitability from product titles, a generic tag, or the language model's memory.
export function eligibleProducts(profile: Profile, products: Product[]): Product[] {
  if (!profile.species || !profile.need || !profile.category) return [];
  return products.filter(p => {
    if (!p.verified || !p.available || !p.species.includes(profile.species!) ||
        p.category !== profile.category || !p.needs.includes(profile.need!)) return false;
    if (!/^https:\/\/furmosa\.com\/products\/[^\s?#]+(?:\?[^\s]*)?$/.test(p.url)) return false;
    if ((p.minAgeMonths !== null || p.maxAgeMonths !== null) && profile.ageMonths === null) return false;
    if (profile.ageMonths !== null && ((p.minAgeMonths !== null && profile.ageMonths < p.minAgeMonths) ||
        (p.maxAgeMonths !== null && profile.ageMonths > p.maxAgeMonths))) return false;
    if (p.category === 'food' && profile.avoid.length &&
        (p.ingredients === null || p.ingredients.some(i => profile.avoid.includes(i)))) return false;
    return profile.requirements.every(c => p.verifiedClaims.includes(c));
  });
}

export function nextTurn(previous: Profile, raw: unknown, catalog: Product[], asked: string[] = [], reviewPending = false) {
  const understanding = validateUnderstanding(raw);
  const profile = mergeProfile(previous, understanding);
  const result = (action: string, reply: string, choices: string[] = [], products: Product[] = []) =>
    ({ action, reply, choices, products, profile });
  if (understanding.medical) return result('handoff', '這涉及健康或治療判斷，先請熟悉牠物種的獸醫確認；我可以協助核對商品標示。');
  if (!understanding.shopping) return result('handoff', '你想詢問哪件商品或購物問題？涉及訂單與個人資料的部分，我會請客服協助。');
  if (!profile.species) return result('ask_species', '這次想幫哪位小夥伴找？也可以直接輸入物種與需求。', ['狗狗', '貓咪', '其他小夥伴']);
  if (profile.species === 'other') return result('ask_species_detail', '牠是哪一種動物？直接輸入也可以。', ['兔兔', '天竺鼠', '倉鼠', '鳥寶']);
  if (!profile.category) return result('ask_need', '這次想找什麼？可以說用途，或描述你遇到的情況。', ['找吃的', '找玩具', '日常照護']);
  if (!profile.need) {
    const choices = profile.category === 'food' ? ['日常零食', '訓練獎勵', '正餐主食'] :
      profile.category === 'toy' ? ['在家放電', '啃咬玩具', '一起互動'] : ['清潔保養', '餐碗與飲水', '外出用品'];
    return result('ask_purpose', '主要想用在什麼情況？', choices);
  }
  const candidates = catalog.filter(p => p.verified && p.available && p.species.includes(profile.species!) && p.category === profile.category && p.needs.includes(profile.need!));
  if (profile.ageMonths === null && candidates.some(p => p.minAgeMonths !== null || p.maxAgeMonths !== null) && !asked.includes('age')) {
    return result('ask_age', '牠目前幾歲或幾個月？我用來核對商品的適用年齡。');
  }
  if (profile.category === 'food' && candidates.length && !profile.avoid.length && !asked.includes('avoid')) {
    return result('ask_avoid', '有需要避開的食材嗎？直接輸入也可以。', ['沒有特別避開', '我想自己輸入']);
  }
  const products = eligibleProducts(profile, catalog).slice(0, 3);
  if (!products.length && reviewPending) return result('review', '部分商品的適用資料還需要核對，目前不能確認是否符合你的需求。可以請客服幫你確認，或先留下許願。', ['請客服確認', '留下許願']);
  if (!products.length) return result('wish', '目前查不到同時符合物種與需求、且資料已確認的商品。想找的東西可以留在許願池。');
  return result('recommend', '這些商品符合目前已確認的條件；可以點進商品頁查看完整標示。', [], products);
}
