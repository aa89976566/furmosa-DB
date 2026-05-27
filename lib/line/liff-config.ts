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

function getLiffIdOptional(page: LiffPage): string | undefined {
  const specific = {
    register: readEnv('LINE_LIFF_ID_REGISTER'),
    profile: readEnv('LINE_LIFF_ID_PROFILE'),
    rewards: readEnv('LINE_LIFF_ID_REWARDS'),
  }[page];
  const fallback = readEnv('LINE_LIFF_ID');
  return specific ?? fallback;
}

export function getLiffId(page: LiffPage): string {
  const id = getLiffIdOptional(page);
  if (!id) {
    throw new Error(`缺少 LIFF ID（${page}），請設定 LINE_LIFF_ID 或 LINE_LIFF_ID_${page.toUpperCase()}`);
  }
  return id;
}

export function getLiffUrl(page: LiffPage): string {
  return `https://liff.line.me/${getLiffId(page)}`;
}

/** 給 Bot 回覆用；未設定 env 時回傳 null，改走純文字 */
export function getLiffUrlIfConfigured(page: LiffPage): string | null {
  const id = getLiffIdOptional(page);
  return id ? `https://liff.line.me/${id}` : null;
}

export function isLiffConfigured(): boolean {
  return Boolean(getLiffIdOptional('register'));
}
