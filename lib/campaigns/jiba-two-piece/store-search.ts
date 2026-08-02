/**
 * 7-11 門市候選搜尋（無電子地圖時的後備）。
 * 不把自由文字直接當正式門市；需顧客明確確認候選。
 */
import { isUnboxLeaveText } from '@/lib/line/session-leave';

export type StoreCandidate = {
  storeId: string;
  storeName: string;
  storeAddress: string;
};

/** 常見門市關鍵字樣本（後續可接真實門市 DB／emap） */
const SEED_STORES: StoreCandidate[] = [
  { storeId: '141391', storeName: '板橋新埔門市', storeAddress: '新北市板橋區民權路 36 號' },
  { storeId: '952147', storeName: '台北車站門市', storeAddress: '台北市中正區北平西路 3 號' },
  { storeId: '113509', storeName: '台中一中門市', storeAddress: '台中市北區一中街 142 號' },
  { storeId: '960819', storeName: '高雄夢時代門市', storeAddress: '高雄市前鎮區中華五路 789 號' },
  { storeId: '122250', storeName: '桃園中壢門市', storeAddress: '桃園市中壢區中正路 215 號' },
  { storeId: '990114', storeName: '新竹竹科門市', storeAddress: '新竹市東區園區二路 9 號' },
  { storeId: '128663', storeName: '台南赤崁門市', storeAddress: '台南市中西區民族路二段 95 號' },
  { storeId: '165588', storeName: '淡水老街門市', storeAddress: '新北市淡水區中正路 15 號' },
];

export function searchStoreCandidates(query: string, limit = 5): StoreCandidate[] {
  const raw = query.trim();
  const q = raw.replace(/\s+/g, '');
  if (q.length < 2) return [];
  // 選單捷徑（介紹／開戶…）不可變成「1.介紹」候選按鈕
  if (isUnboxLeaveText(raw)) return [];

  const scored = SEED_STORES.map((s) => {
    const hay = `${s.storeName}${s.storeAddress}${s.storeId}`.replace(/\s+/g, '');
    let score = 0;
    if (hay.includes(q)) score += 10;
    for (const part of q.split(/(?=[縣市鄉鎮市區])/).filter(Boolean)) {
      if (part.length >= 2 && hay.includes(part)) score += 3;
    }
    // 子字串：板橋、新埔
    const tokens = q.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
    for (const t of tokens) {
      if (hay.includes(t)) score += 2;
    }
    return { s, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const hits = scored.slice(0, limit).map((x) => x.s);

  // 附上「顧客輸入」作為待確認候選（storeId 空字串代表未驗證店號）
  const freeText: StoreCandidate = {
    storeId: '',
    storeName: raw,
    storeAddress: raw,
  };
  const names = new Set(hits.map((h) => h.storeName));
  if (!names.has(freeText.storeName)) {
    hits.push(freeText);
  }
  return hits.slice(0, limit + 1);
}
