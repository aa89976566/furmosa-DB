import { allowsExternalEffects } from '@/lib/external-effects';
import { getLineChannelAccessToken } from '@/lib/line/config';

/** Runtime adapter：僅在 choke 讀取兩個政策變數名，傳給純核心。 */
function isLineExternalEffectsAllowed(): boolean {
  return allowsExternalEffects({
    APP_ENV: process.env.APP_ENV,
    EXTERNAL_EFFECTS_MODE: process.env.EXTERNAL_EFFECTS_MODE,
  });
}

export async function fetchLineUserDisplayName(lineUserId: string): Promise<string | null> {
  if (!isLineExternalEffectsAllowed()) return null;
  try {
    const token = getLineChannelAccessToken();
    const res = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(lineUserId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { displayName?: string };
    return data.displayName?.trim() || null;
  } catch {
    return null;
  }
}
