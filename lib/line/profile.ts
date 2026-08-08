import { getLineChannelAccessToken } from '@/lib/line/config';

export type LineUserProfile = {
  displayName: string | null;
  pictureUrl: string | null;
};

type LineProfileApiResponse = {
  displayName?: string;
  pictureUrl?: string;
};

function parseLineUserProfile(data: LineProfileApiResponse): LineUserProfile {
  const displayName =
    typeof data.displayName === 'string' ? data.displayName.trim() || null : null;
  const pictureUrl =
    typeof data.pictureUrl === 'string' ? data.pictureUrl.trim() || null : null;
  return { displayName, pictureUrl };
}

/**
 * Server-only：官方 Messaging API GET /v2/bot/profile/{userId}
 * 失敗（含未加好友／封鎖／缺 token）回傳 null，不拋錯。
 * 不記錄 profile 內容（個資）。
 */
export async function fetchLineUserProfile(
  lineUserId: string,
): Promise<LineUserProfile | null> {
  const uid = lineUserId.trim();
  if (!uid) return null;

  try {
    const token = getLineChannelAccessToken();
    const res = await fetch(
      `https://api.line.me/v2/bot/profile/${encodeURIComponent(uid)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as LineProfileApiResponse;
    return parseLineUserProfile(data);
  } catch {
    return null;
  }
}

/** 相容既有綁定流程：只取顯示名稱 */
export async function fetchLineUserDisplayName(
  lineUserId: string,
): Promise<string | null> {
  const profile = await fetchLineUserProfile(lineUserId);
  return profile?.displayName ?? null;
}

/** 純函式：供測試與 UI 組裝（不碰網路） */
export function parseLineProfileResponse(
  data: unknown,
): LineUserProfile | null {
  if (!data || typeof data !== 'object') return null;
  return parseLineUserProfile(data as LineProfileApiResponse);
}
