import { getLineChannelAccessToken } from '@/lib/line/config';

export async function fetchLineUserDisplayName(lineUserId: string): Promise<string | null> {
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
