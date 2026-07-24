/**
 * 部署「三世界」Rich Menu（覆蓋舊六宮格）。
 *
 * 用法（需 Messaging API token）：
 *   LINE_CHANNEL_ACCESS_TOKEN=xxx npx tsx scripts/deploy-line-rich-menu.ts
 *
 * 三格皆傳訊息觸發 Flex：
 *   換罐計畫 / 一起搞事 / 野放中
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
  const body = {
    size: { width: 2500, height: 843 },
    selected: true,
    name: 'furmosa-three-worlds',
    chatBarText: '選單',
    areas: [
      {
        bounds: { x: 0, y: 0, width: 833, height: 843 },
        action: { type: 'message', text: '換罐計畫' },
      },
      {
        bounds: { x: 833, y: 0, width: 834, height: 843 },
        action: { type: 'message', text: '一起搞事' },
      },
      {
        bounds: { x: 1667, y: 0, width: 833, height: 843 },
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

  const imagePath = resolve('public/line/rich-menu-three-worlds.png');
  const png = readFileSync(imagePath);
  const uploadRes = await fetch(
    `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'image/png',
      },
      body: png,
    },
  );
  if (!uploadRes.ok) {
    console.error('上傳圖片失敗', uploadRes.status, await uploadRes.text());
    process.exit(1);
  }
  console.log('image uploaded');

  const defRes = await fetch(`${API}/user/all/richmenu/${richMenuId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!defRes.ok) {
    console.error('設為預設失敗', defRes.status, await defRes.text());
    process.exit(1);
  }
  console.log('set as default for all users');
  console.log('Done. Users may need to reopen the chat to see the new menu.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
