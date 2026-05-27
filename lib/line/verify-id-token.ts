import { getLineChannelId } from '@/lib/line/liff-config';

export type LineIdTokenPayload = {
  sub: string;
  name?: string;
  picture?: string;
};

export async function verifyLineIdToken(idToken: string): Promise<LineIdTokenPayload> {
  const clientId = getLineChannelId();
  const body = new URLSearchParams({
    id_token: idToken,
    client_id: clientId,
  });

  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = (await res.json().catch(() => ({}))) as {
    sub?: string;
    name?: string;
    picture?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.sub) {
    const msg = data.error_description ?? data.error ?? `ID Token 驗證失敗 (${res.status})`;
    throw new Error(msg);
  }

  return {
    sub: data.sub,
    name: data.name,
    picture: data.picture,
  };
}
