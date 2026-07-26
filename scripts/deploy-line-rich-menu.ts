/**
 * 部署四格漫畫 Rich Menu（2×2）。
 *
 * 用法：
 *   LINE_CHANNEL_ACCESS_TOKEN=xxx npx tsx scripts/deploy-line-rich-menu.ts
 *
 * 圖檔優先：public/line/rich-menu-comic-2x2.jpg
 * 熱區依 rich-menu-comic-2x2.meta.json 的 content box（contain 留邊後的實際圖面）。
 *
 * 熱區：
 *   左上 一起野放 → 社區／UGC／活動
 *   右上 預約美容 → 好玩的還沒好
 *   左下 換罐計劃 → 開戶／序號／會員
 *   右下 回家 → furmosa.com＋@furmosa_food
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
if (!TOKEN) {
  console.error('缺少 LINE_CHANNEL_ACCESS_TOKEN');
  process.exit(1);
}

const API = 'https://api.line.me/v2/bot';
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

const CANVAS_W = 2500;
const CANVAS_H = 1686;

type ContentBox = { x: number; y: number; width: number; height: number };

function loadContentBox(): ContentBox {
  const metaPath = resolve('public/line/rich-menu-comic-2x2.meta.json');
  if (existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as {
      content?: ContentBox;
    };
    if (
      meta.content &&
      Number.isFinite(meta.content.x) &&
      Number.isFinite(meta.content.y) &&
      Number.isFinite(meta.content.width) &&
      Number.isFinite(meta.content.height)
    ) {
      return meta.content;
    }
  }
  // 後備：整張等分（舊 cover 圖）
  return { x: 0, y: 0, width: CANVAS_W, height: CANVAS_H };
}

/** 左格含左側白邊、右格含右側白邊，避免點到留邊沒反應。 */
function buildAreas(content: ContentBox) {
  const midX = content.x + Math.floor(content.width / 2);
  const midY = content.y + Math.floor(content.height / 2);
  const leftW = midX;
  const rightW = CANVAS_W - midX;
  const topH = midY;
  const bottomH = CANVAS_H - midY;

  return [
    {
      bounds: { x: 0, y: 0, width: leftW, height: topH },
      action: { type: 'message' as const, text: '一起野放' },
    },
    {
      bounds: { x: midX, y: 0, width: rightW, height: topH },
      action: { type: 'message' as const, text: '預約美容' },
    },
    {
      bounds: { x: 0, y: midY, width: leftW, height: bottomH },
      action: { type: 'message' as const, text: '換罐計畫' },
    },
    {
      bounds: { x: midX, y: midY, width: rightW, height: bottomH },
      action: { type: 'message' as const, text: '回家' },
    },
  ];
}

async function main() {
  const listRes = await fetch(`${API}/richmenu/list`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  let existing: { richMenuId: string; name: string }[] = [];
  if (listRes.ok) {
    const list = (await listRes.json()) as { richmenus?: { richMenuId: string; name: string }[] };
    existing = list.richmenus ?? [];
    console.log(
      'existing rich menus:',
      existing.map((m) => `${m.name} (${m.richMenuId})`).join(', ') || '(none)',
    );
  }

  const content = loadContentBox();
  const areas = buildAreas(content);
  console.log('content box', content);
  console.log(
    'areas',
    areas.map((a) => `${a.action.text} ${JSON.stringify(a.bounds)}`).join(' | '),
  );

  const body = {
    size: { width: CANVAS_W, height: CANVAS_H },
    selected: true,
    name: 'furmosa-comic-2x2',
    chatBarText: '選單',
    areas,
  };

  const createRes = await fetch(`${API}/richmenu`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const createJson = (await createRes.json()) as { richMenuId?: string; message?: string };
  if (!createRes.ok || !createJson.richMenuId) {
    console.error('建立 Rich Menu 失敗', createRes.status, createJson);
    process.exit(1);
  }
  const richMenuId = createJson.richMenuId;
  console.log('created', richMenuId);

  const candidates = [
    resolve('public/line/rich-menu-comic-2x2.jpg'),
    resolve('public/line/rich-menu-comic-2x2.png'),
    resolve('public/line/rich-menu-three-worlds.jpg'),
    resolve('public/line/rich-menu-three-worlds.png'),
  ];
  const imagePath = candidates.find((p) => existsSync(p));
  if (!imagePath) {
    console.error('找不到 Rich Menu 圖檔');
    process.exit(1);
  }
  const bytes = readFileSync(imagePath);
  const contentType =
    imagePath.endsWith('.jpg') || imagePath.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
  console.log('uploading', imagePath, bytes.length, 'bytes');

  const uploadRes = await fetch(
    `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': contentType,
      },
      body: bytes,
    },
  );
  if (!uploadRes.ok) {
    console.error('上傳圖片失敗', uploadRes.status, await uploadRes.text());
    process.exit(1);
  }
  console.log('image uploaded');

  const defRes = await fetch(`${API}/user/all/richmenu/${richMenuId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Length': '0',
    },
  });
  if (!defRes.ok) {
    console.error('設為預設失敗', defRes.status, await defRes.text());
    process.exit(1);
  }
  console.log('set as default for all users');

  // 清掉同名舊選單，避免 OA 裡堆太多
  for (const m of existing) {
    if (m.name === 'furmosa-comic-2x2' && m.richMenuId !== richMenuId) {
      const del = await fetch(`${API}/richmenu/${m.richMenuId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      console.log('deleted old', m.richMenuId, del.status);
    }
  }

  console.log('Done. Reopen chat → 2×2 comic menu (text fully visible).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
