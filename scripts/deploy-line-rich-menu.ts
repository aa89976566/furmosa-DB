/**
 * 部署四格漫畫 Rich Menu（2×2）。
 *
 * 用法：
 *   LINE_CHANNEL_ACCESS_TOKEN=xxx npx tsx scripts/deploy-line-rich-menu.ts
 *
 * 圖檔優先：public/line/rich-menu-comic-2x2.jpg
 *
 * 熱區：
 *   左上 一起野放 → 一起搞事／新鮮事
 *   右上 預約美容 → 美容導引
 *   左下 換罐計畫 → 換罐制度
 *   右下 回家 → 官網／社群／故事
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

async function main() {
  const listRes = await fetch(`${API}/richmenu/list`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (listRes.ok) {
    const list = (await listRes.json()) as { richmenus?: { richMenuId: string; name: string }[] };
    console.log(
      'existing rich menus:',
      (list.richmenus ?? []).map((m) => `${m.name} (${m.richMenuId})`).join(', ') || '(none)',
    );
  }

  const halfW = 1250;
  const halfH = 843;
  const body = {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: 'furmosa-comic-2x2',
    chatBarText: '選單',
    areas: [
      {
        bounds: { x: 0, y: 0, width: halfW, height: halfH },
        action: { type: 'message', text: '一起野放' },
      },
      {
        bounds: { x: halfW, y: 0, width: halfW, height: halfH },
        action: { type: 'message', text: '預約美容' },
      },
      {
        bounds: { x: 0, y: halfH, width: halfW, height: 1686 - halfH },
        action: { type: 'message', text: '換罐計畫' },
      },
      {
        bounds: { x: halfW, y: halfH, width: halfW, height: 1686 - halfH },
        action: { type: 'message', text: '回家' },
      },
    ],
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
  const contentType = imagePath.endsWith('.jpg') || imagePath.endsWith('.jpeg')
    ? 'image/jpeg'
    : 'image/png';
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
  console.log('Done. Reopen chat → 2×2 comic menu.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
