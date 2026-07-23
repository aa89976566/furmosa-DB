import { redirect } from 'next/navigation';
import {
  getMerchantSessionFromCookies,
  type MerchantSessionPayload,
} from '@/lib/merchant-auth/session';

export class MerchantAccessError extends Error {
  constructor(message = '無權存取此店家資料') {
    super(message);
    this.name = 'MerchantAccessError';
  }
}

/**
 * Require a valid merchant POS session. HQ admin session is never accepted.
 */
export async function requireMerchantSession(): Promise<MerchantSessionPayload> {
  const session = await getMerchantSessionFromCookies();
  if (!session) {
    redirect('/pos/login');
  }
  return session;
}

/** Always from session — never from client input. */
export async function getAuthenticatedMerchantId(): Promise<string> {
  const session = await requireMerchantSession();
  return session.merchantId;
}

/**
 * Ensure the resource belongs to the authenticated merchant.
 * Pass the session merchantId (or omit to load from cookies).
 */
export function assertMerchantAccess(
  resourceMerchantId: string,
  sessionMerchantId: string,
): void {
  if (!resourceMerchantId || !sessionMerchantId) {
    throw new MerchantAccessError();
  }
  if (resourceMerchantId !== sessionMerchantId) {
    throw new MerchantAccessError();
  }
}

/** Scope helper for Prisma where clauses — always use session id. */
export function merchantScope(sessionMerchantId: string) {
  return { merchantId: sessionMerchantId } as const;
}

/**
 * Resolve which merchantId to use for a POS query.
 * Client-supplied ids are ignored; session wins.
 */
export function resolveMerchantIdForQuery(
  sessionMerchantId: string,
  _clientMerchantId?: string | null,
): string {
  return sessionMerchantId;
}
