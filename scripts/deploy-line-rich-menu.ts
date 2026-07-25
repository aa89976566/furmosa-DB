/**
 * 部署「三張大卡」Rich Menu（覆蓋舊六宮格 icon 選單）。
 *
 * 用法：
 *   LINE_CHANNEL_ACCESS_TOKEN=xxx npx tsx scripts/deploy-line-rich-menu.ts
 *
 * 圖檔：public/line/rich-menu-three-worlds.png（2500×1686，直向三列大卡）
 * 三列皆傳訊息 → webhook 回卡片式 Flex carousel。
 */
import { readFileSync } from 'node:fs';
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
  // 先列出舊選單，部署後可手動刪（避免額度佔用）
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

  const rowH = 562;
  const body = {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: 'furmosa-three-world-cards',
    chatBarText: '選單',
    areas: [
      {
        bounds: { x: 0, y: 0, width: 2500, height: rowH },
        action: { type: 'message', text: '換罐計畫' },
      },
      {
        bounds: { x: 0, y: rowH, width: 2500, height: rowH },
        action: { type: 'message', text: '一起搞事' },
      },
      {
        bounds: { x: 0, y: rowH * 2, width: 2500, height: 1686 - rowH * 2 },
        action: { type: 'message', text: '野放中' },
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

  // JPEG 較易壓在 LINE 1MB 限制內（換罐計畫大圖用照片時尤其需要）
  const jpgPath = resolve('public/line/rich-menu-three-worlds.jpg');
  const pngPath = resolve('public/line/rich-menu-three-worlds.png');
  const { existsSync } = await import('node:fs');
  const imagePath = existsSync(jpgPath) ? jpgPath : pngPath;
  const bytes = readFileSync(imagePath);
  const contentType = imagePath.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
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
  console.log('image uploaded', imagePath, png.length, 'bytes');

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
  console.log('Done. Reopen the chat to see three large cards (not six icons).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
