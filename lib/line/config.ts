/** 動態 key 讀取，避免 build 時未設定的 env 被 next 內嵌成 undefined */
function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getLineChannelSecret(): string {
  const v = readEnv('LINE_CHANNEL_SECRET');
  if (!v) throw new Error('缺少環境變數 LINE_CHANNEL_SECRET');
  return v;
}

export function getLineChannelAccessToken(): string {
  const v = readEnv('LINE_CHANNEL_ACCESS_TOKEN');
  if (!v) throw new Error('缺少環境變數 LINE_CHANNEL_ACCESS_TOKEN');
  return v;
}

export function isLineWebhookConfigured(): boolean {
  return Boolean(readEnv('LINE_CHANNEL_SECRET') && readEnv('LINE_CHANNEL_ACCESS_TOKEN'));
}

export function getLineWebhookEnvChecks() {
  return {
    secret: Boolean(readEnv('LINE_CHANNEL_SECRET')),
    token: Boolean(readEnv('LINE_CHANNEL_ACCESS_TOKEN')),
  };
}
