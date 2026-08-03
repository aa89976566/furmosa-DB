/**
 * 7-11 門市候選搜尋。
 * 正式物流可接綠界電子地圖／門市清單 API；此處先用可搜尋樣本＋顧客確認。
 * @see https://developers.ecpay.com.tw/8795/ 門市電子地圖
 */
import { isJarMenuLeaveText, isWorldNavLeaveText } from '@/lib/line/session-leave';

export type StoreCandidate = {
  storeId: string;
  storeName: string;
  storeAddress: string;
};

/** 常見門市關鍵字樣本（後續可接真實門市 DB／emap／綠界清單） */
const SEED_STORES: StoreCandidate[] = [
  { storeId: '141391', storeName: '板橋新埔門市', storeAddress: '新北市板橋區民權路 36 號' },
  { storeId: '952147', storeName: '台北車站門市', storeAddress: '台北市中正區北平西路 3 號' },
  { storeId: '113509', storeName: '台中一中門市', storeAddress: '台中市北區一中街 142 號' },
  { storeId: '960819', storeName: '高雄夢時代門市', storeAddress: '高雄市前鎮區中華五路 789 號' },
  { storeId: '122250', storeName: '桃園中壢門市', storeAddress: '桃園市中壢區中正路 215 號' },
  { storeId: '990114', storeName: '新竹竹科門市', storeAddress: '新竹市東區園區二路 9 號' },
  { storeId: '128663', storeName: '台南赤崁門市', storeAddress: '台南市中西區民族路二段 95 號' },
  { storeId: '165588', storeName: '淡水老街門市', storeAddress: '新北市淡水區中正路 15 號' },
  { storeId: '130669', storeName: '士林夜市門市', storeAddress: '台北市士林區大東路 20 號' },
  { storeId: '211514', storeName: '西門町門市', storeAddress: '台北市萬華區成都路 10 號' },
  { storeId: '128887', storeName: '公館門市', storeAddress: '台北市中正區羅斯福路四段 68 號' },
  { storeId: '992174', storeName: '忠孝復興門市', storeAddress: '台北市大安區大安路一段 77 號' },
  { storeId: '149519', storeName: '三重重新門市', storeAddress: '新北市三重區重新路三段 15 號' },
  { storeId: '131055', storeName: '中和景安門市', storeAddress: '新北市中和區景安路 212 號' },
  { storeId: '167715', storeName: '新店北新門市', storeAddress: '新北市新店區北新路三段 145 號' },
  { storeId: '124563', storeName: '林口三井門市', storeAddress: '新北市林口區文化三路一段 356 號' },
  { storeId: '158881', storeName: '南港軟體門市', storeAddress: '台北市南港區園區街 3 號' },
  { storeId: '110733', storeName: '逢甲門市', storeAddress: '台中市西屯區文華路 100 號' },
  { storeId: '129915', storeName: '嘉義文化門市', storeAddress: '嘉義市東區文化路 255 號' },
  { storeId: '990885', storeName: '花蓮中山門市', storeAddress: '花蓮縣花蓮市中山路 380 號' },
];

/** 官方門市查詢（顧客可先查店名再回來貼） */
export const SEVEN_ELEVEN_STORE_FINDER_URL =
  'https://www.7-11.com.tw/freshfoods/map/index.aspx';

export function isStoreLeaveNoise(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  // 世界導覽才算真離開；「介紹」等換罐捷徑在選門市時當雜訊，不當門市名
  if (isWorldNavLeaveText(t)) return false;
  return isJarMenuLeaveText(t);
}

export function searchStoreCandidates(query: string, limit = 5): StoreCandidate[] {
  const raw = query.trim();
  const q = raw.replace(/\s+/g, '');
  if (q.length < 2) return [];
  // 選單捷徑（介紹／開戶…）不可變成「1.介紹」候選按鈕
  if (isStoreLeaveNoise(raw) || isWorldNavLeaveText(raw)) return [];

  const scored = SEED_STORES.map((s) => {
    const hay = `${s.storeName}${s.storeAddress}${s.storeId}`.replace(/\s+/g, '');
    let score = 0;
    if (hay.includes(q)) score += 10;
    // 去掉「門市」再比一次
    const qCore = q.replace(/門市$/g, '');
    if (qCore.length >= 2 && hay.includes(qCore)) score += 8;
    for (const part of q.split(/(?=[縣市鄉鎮市區])/).filter(Boolean)) {
      if (part.length >= 2 && hay.includes(part)) score += 3;
    }
    const tokens = q.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
    for (const t of tokens) {
      if (hay.includes(t)) score += 2;
    }
    return { s, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const hits = scored.slice(0, limit).map((x) => x.s);

  // 有官方店號命中時，不再把自由輸入當候選（避免「介紹」類雜訊）
  if (hits.length > 0 && hits.some((h) => h.storeId)) {
    return hits.slice(0, limit);
  }

  const freeText: StoreCandidate = {
    storeId: '',
    storeName: raw.endsWith('門市') ? raw : `${raw}門市`,
    storeAddress: raw,
  };
  return [...hits, freeText].slice(0, limit);
}
