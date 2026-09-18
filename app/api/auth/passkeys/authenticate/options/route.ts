import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  createPasskeyChallengeToken,
  resolveHqPasskeyContext,
  setPasskeyChallengeCookie,
} from '@/lib/hq-passkeys';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { rpID } = resolveHqPasskeyContext(request);
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'required',
    });
    const token = await createPasskeyChallengeToken({
      kind: 'authentication',
      challenge: options.challenge,
    });
    const response = NextResponse.json(options);
    setPasskeyChallengeCookie(response, 'authentication', token);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Face ID 暫時無法使用';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

