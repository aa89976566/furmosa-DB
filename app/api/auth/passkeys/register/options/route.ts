import { generateRegistrationOptions } from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  createPasskeyChallengeToken,
  HQ_PASSKEY_RP_NAME,
  resolveHqPasskeyContext,
  setPasskeyChallengeCookie,
} from '@/lib/hq-passkeys';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ error: '請先登入 HQ' }, { status: 401 });
    const { rpID } = resolveHqPasskeyContext(request);
    const credentials = await prisma.hqPasskeyCredential.findMany({
      where: { userId: session.userId },
      select: { credentialId: true, transports: true },
    });
    const options = await generateRegistrationOptions({
      rpName: HQ_PASSKEY_RP_NAME,
      rpID,
      userID: new TextEncoder().encode(session.userId),
      userName: session.email,
      userDisplayName: session.name,
      attestationType: 'none',
      excludeCredentials: credentials.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports,
      })),
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      preferredAuthenticatorType: 'localDevice',
    });
    const token = await createPasskeyChallengeToken({
      kind: 'registration',
      challenge: options.challenge,
      userId: session.userId,
      webauthnUserId: options.user.id,
    });
    const response = NextResponse.json(options);
    setPasskeyChallengeCookie(response, 'registration', token);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : '無法啟用 Face ID';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
