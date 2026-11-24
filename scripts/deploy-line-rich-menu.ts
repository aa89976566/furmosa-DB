/**
 * 部署「購物 × 換罐」六入口 Rich Menu。
 * 只在人工執行此檔時才會呼叫 LINE API。
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LINE_RICH_MENU_BODY } from '../lib/line/rich-menu-config';

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
if (!TOKEN) {
  console.error('缺少 LINE_CHANNEL_ACCESS_TOKEN');
  process.exit(1);
}

const API = 'https://api.line.me/v2/bot';
const authHeaders = { Authorization: `Bearer ${TOKEN}` };
const jsonHeaders = { ...authHeaders, 'Content-Type': 'application/json' };

async function main() {
  const listRes = await fetch(`${API}/richmenu/list`, { headers: authHeaders });
  if (!listRes.ok) throw new Error(`讀取既有 Rich Menu 失敗：${listRes.status}`);
  const list = (await listRes.json()) as {
    richmenus?: { richMenuId: string; name: string }[];
  };
  const existing = list.richmenus ?? [];

  const createRes = await fetch(`${API}/richmenu`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(LINE_RICH_MENU_BODY),
  });
  const created = (await createRes.json()) as { richMenuId?: string; message?: string };
  if (!createRes.ok || !created.richMenuId) {
    throw new Error(`建立 Rich Menu 失敗：${createRes.status} ${created.message ?? ''}`);
  }
  const richMenuId = created.richMenuId;

  const candidates = [
    resolve('public/line/rich-menu-shop-refill.jpg'),
    resolve('public/line/rich-menu-shop-refill.png'),
  ];
  const imagePath = candidates.find((candidate) => existsSync(candidate));
  if (!imagePath) throw new Error('找不到新版 Rich Menu 圖檔');

  const image = readFileSync(imagePath);
  const contentType = imagePath.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
  const uploadRes = await fetch(
    `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
    { method: 'POST', headers: { ...authHeaders, 'Content-Type': contentType }, body: image },
  );
  if (!uploadRes.ok) {
    await fetch(`${API}/richmenu/${richMenuId}`, { method: 'DELETE', headers: authHeaders });
    throw new Error(`上傳圖片失敗：${uploadRes.status} ${await uploadRes.text()}`);
  }

  const defaultRes = await fetch(`${API}/user/all/richmenu/${richMenuId}`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Length': '0' },
  });
  if (!defaultRes.ok) {
    await fetch(`${API}/richmenu/${richMenuId}`, { method: 'DELETE', headers: authHeaders });
    throw new Error(`設為預設選單失敗：${defaultRes.status} ${await defaultRes.text()}`);
  }

  // 新選單成功後才清同名舊版；不碰其他活動選單。
  for (const menu of existing) {
    if (menu.name !== LINE_RICH_MENU_BODY.name || menu.richMenuId === richMenuId) continue;
    const deleted = await fetch(`${API}/richmenu/${menu.richMenuId}`, {
      method: 'DELETE', headers: authHeaders,
    });
    if (!deleted.ok) console.warn('舊版選單未刪除', menu.richMenuId, deleted.status);
  }

  console.log(`Rich Menu 已建立並設為預設：${richMenuId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
