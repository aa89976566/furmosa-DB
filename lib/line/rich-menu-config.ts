export const LINE_RICH_MENU_SIZE = { width: 2500, height: 1686 } as const;

export type RichMenuAction =
  | { type: 'message'; text: string }
  | { type: 'uri'; uri: string };

export type RichMenuArea = {
  bounds: { x: number; y: number; width: number; height: number };
  action: RichMenuAction;
};

/**
 * 新版選單沿用既有 Bot 指令。標題區只作品牌識別，不設點擊區，
 * 避免使用者誤觸；其餘六區完整覆蓋可操作範圍。
 */
export const LINE_RICH_MENU_AREAS: readonly RichMenuArea[] = [
  {
    bounds: { x: 0, y: 200, width: 1375, height: 1260 },
    action: { type: 'message', text: '線上購物' },
  },
  {
    bounds: { x: 1375, y: 200, width: 1125, height: 1260 },
    action: { type: 'message', text: '換罐計畫' },
  },
  {
    bounds: { x: 0, y: 1460, width: 625, height: 226 },
    action: { type: 'message', text: '會員點數' },
  },
  {
    bounds: { x: 625, y: 1460, width: 625, height: 226 },
    action: { type: 'message', text: '申請合作' },
  },
  {
    bounds: { x: 1250, y: 1460, width: 625, height: 226 },
    action: { type: 'message', text: '問問匠寵' },
  },
  {
    bounds: { x: 1875, y: 1460, width: 625, height: 226 },
    action: { type: 'message', text: '一起野放' },
  },
] as const;

export const LINE_RICH_MENU_BODY = {
  size: LINE_RICH_MENU_SIZE,
  selected: true,
  name: 'furmosa-shop-refill-v1',
  chatBarText: '今天想找什麼？',
  areas: LINE_RICH_MENU_AREAS,
} as const;
