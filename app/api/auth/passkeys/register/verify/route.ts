import {
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  clearPasskeyChallengeCookie,
  passkeyDeviceName,
  readPasskeyChallenge,
  resolveHqPasskeyContext,
} from '@/lib/hq-passkeys';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function failure(error: string, status = 400) {
  const response = NextResponse.json({ error }, { status });
  clearPasskeyChallengeCookie(response, 'registration');
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) return failure('請先登入 HQ', 401);
    const challenge = await readPasskeyChallenge('registration');
    if (!challenge || challenge.userId !== session.userId || !challenge.webauthnUserId) {
      return failure('Face ID 設定已逾時，請重新操作');
    }
    const { rpID, origin } = resolveHqPasskeyContext(request);
    const body = await request.json() as RegistrationResponseJSON;
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      return failure('Face ID 驗證失敗，請再試一次');
    }
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    await prisma.hqPasskeyCredential.create({
      data: {
        credentialId: credential.id,
        userId: session.userId,
        webauthnUserId: challenge.webauthnUserId,
        publicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.transports ?? [],
        deviceName: passkeyDeviceName(request.headers.get('user-agent')),
        userAgent: request.headers.get('user-agent'),
      },
    });
    const response = NextResponse.json({ ok: true });
    clearPasskeyChallengeCookie(response, 'registration');
    return response;
  } catch (error) {
    console.error('[hq/passkey/register]', error);
    return failure('無法完成 Face ID 設定，請重新操作');
  }
}
