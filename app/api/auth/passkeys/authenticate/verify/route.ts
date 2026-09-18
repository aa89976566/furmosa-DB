import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import { setSessionCookie, signSession } from '@/lib/auth';
import {
  clearPasskeyChallengeCookie,
  readPasskeyChallenge,
  resolveHqPasskeyContext,
} from '@/lib/hq-passkeys';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function failure(error: string, status = 400) {
  const response = NextResponse.json({ error }, { status });
  clearPasskeyChallengeCookie(response, 'authentication');
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const challenge = await readPasskeyChallenge('authentication');
    if (!challenge) return failure('Face ID 登入已逾時，請重新操作');
    const { rpID, origin } = resolveHqPasskeyContext(request);
    const body = await request.json() as AuthenticationResponseJSON;
    if (!body?.id) return failure('Face ID 回傳資料不完整');
    const passkey = await prisma.hqPasskeyCredential.findUnique({
      where: { credentialId: body.id },
      include: { user: true },
    });
    if (!passkey) return failure('找不到這台裝置的 HQ Face ID');
    if (body.response.userHandle && body.response.userHandle !== passkey.webauthnUserId) {
      return failure('Face ID 帳號不相符');
    }
    const storedCounter = Number(passkey.counter);
    if (!Number.isSafeInteger(storedCounter)) return failure('Face ID 憑證計數異常');
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: storedCounter,
        transports: passkey.transports,
      },
      requireUserVerification: true,
    });
    if (!verification.verified) return failure('Face ID 驗證失敗');
    await prisma.hqPasskeyCredential.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    });
    const token = await signSession({
      userId: passkey.user.id,
      email: passkey.user.email,
      name: passkey.user.name,
      role: passkey.user.role,
    });
    await setSessionCookie(token);
    const response = NextResponse.json({ ok: true });
    clearPasskeyChallengeCookie(response, 'authentication');
    return response;
  } catch (error) {
    console.error('[hq/passkey/authenticate]', error);
    return failure('Face ID 登入失敗，請改用密碼或重新操作');
  }
}

