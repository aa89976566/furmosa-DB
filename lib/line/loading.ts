import { getLineChannelAccessToken } from '@/lib/line/config';

/**
 * LINE 官方「正在輸入／Loading」動畫。
 * 不阻塞主流程：失敗只記 log，不影響回覆。
 * @see https://developers.line.biz/en/docs/messaging-api/use-loading-indicator/
 */
export async function showLineLoadingAnimation(
  lineUserId: string,
  loadingSeconds: 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 | 55 | 60 = 20,
): Promise<void> {
  const chatId = lineUserId.trim();
  if (!chatId.startsWith('U')) return;
  try {
    const token = getLineChannelAccessToken();
    const res = await fetch('https://api.line.me/v2/bot/chat/loading/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ chatId, loadingSeconds }),
    });
    if (!res.ok && res.status !== 202) {
      const body = await res.text().catch(() => '');
      console.warn('[line/loading] start failed', res.status, body.slice(0, 120));
    }
  } catch (err) {
    console.warn('[line/loading] start error', err);
  }
}
