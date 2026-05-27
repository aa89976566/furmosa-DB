export function getLineChannelSecret(): string {
  const v = process.env.LINE_CHANNEL_SECRET?.trim();
  if (!v) throw new Error('缺少環境變數 LINE_CHANNEL_SECRET');
  return v;
}

export function getLineChannelAccessToken(): string {
  const v = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!v) throw new Error('缺少環境變數 LINE_CHANNEL_ACCESS_TOKEN');
  return v;
}

export function isLineWebhookConfigured(): boolean {
  return Boolean(
    process.env.LINE_CHANNEL_SECRET?.trim() && process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim(),
  );
}
