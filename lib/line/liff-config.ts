/** LIFF App ID（LINE Developers → LIFF） */

export type LiffPage = 'register' | 'profile' | 'rewards';

function readEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

/** Messaging API Channel ID（Basic settings），用於驗證 ID Token */
export function getLineChannelId(): string {
  const id = readEnv('LINE_CHANNEL_ID');
  if (!id) throw new Error('缺少環境變數 LINE_CHANNEL_ID');
  return id;
}

export function getLiffId(page: LiffPage): string {
  const specific = {
    register: readEnv('LINE_LIFF_ID_REGISTER'),
    profile: readEnv('LINE_LIFF_ID_PROFILE'),
    rewards: readEnv('LINE_LIFF_ID_REWARDS'),
  }[page];

  const fallback = readEnv('LINE_LIFF_ID');
  const id = specific ?? fallback;
  if (!id) {
    throw new Error(`缺少 LIFF ID（${page}），請設定 LINE_LIFF_ID 或 LINE_LIFF_ID_${page.toUpperCase()}`);
  }
  return id;
}

export function getLiffUrl(page: LiffPage): string {
  return `https://liff.line.me/${getLiffId(page)}`;
}

export function isLiffConfigured(): boolean {
  return Boolean(readEnv('LINE_LIFF_ID') || readEnv('LINE_LIFF_ID_REGISTER'));
}
