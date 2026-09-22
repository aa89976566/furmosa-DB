import { SignJWT, jwtVerify } from 'jose';
import { getAuthSecretKey } from '@/lib/auth-secret';

const ISSUER = 'furmosa-pos';
const AUDIENCE = 'merchant-line-bind';
const MAX_AGE_SECONDS = 10 * 60;

export async function createMerchantLineBindToken(merchantId: string): Promise<string> {
  return new SignJWT({ merchantId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getAuthSecretKey());
}

export async function verifyMerchantLineBindToken(token: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.merchantId !== 'string' || !payload.merchantId) {
      throw new Error('missing merchant');
    }
    return payload.merchantId;
  } catch {
    throw new Error('綁定連結已失效，請回 POS 重新點擊綁定。');
  }
}
