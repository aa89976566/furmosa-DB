'use server';

import { getCurrentUser } from '@/lib/auth';
import {
  IDENTITY_WRITE_OPERATIONS,
  denyIdentityWrite,
  type IdentityWriteOperation,
} from '@/lib/jar-exchange/partner-store-identity-write-guard';

export type IdentityWriteActionResult =
  | { ok: true }
  | { ok: false; error: string; reason?: string };

function rejectWrite(operation: IdentityWriteOperation): IdentityWriteActionResult {
  const blocked = denyIdentityWrite(operation);
  if (blocked) return blocked;
  return { ok: false, error: '這個寫入動作尚未開放', reason: 'not_implemented' };
}

export async function createPreviewAcceptanceIdentityData(): Promise<IdentityWriteActionResult> {
  return rejectWrite('create_acceptance');
}

export async function confirmPartnerStoreIdentity(): Promise<IdentityWriteActionResult> {
  const blocked = denyIdentityWrite('confirm');
  if (blocked) return blocked;
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: '請先登入總部帳號', reason: 'unauthenticated' };
  return { ok: false, error: '這個寫入動作尚未開放', reason: 'not_implemented' };
}

export async function revokePartnerStoreIdentity(): Promise<IdentityWriteActionResult> {
  const blocked = denyIdentityWrite('revoke');
  if (blocked) return blocked;
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: '請先登入總部帳號', reason: 'unauthenticated' };
  return { ok: false, error: '這個寫入動作尚未開放', reason: 'not_implemented' };
}

export async function addPartnerStoreIdentity(): Promise<IdentityWriteActionResult> {
  return rejectWrite('add');
}

export async function activatePartnerStoreIdentity(): Promise<IdentityWriteActionResult> {
  return rejectWrite('activate');
}

export async function modifyPartnerStoreIdentity(): Promise<IdentityWriteActionResult> {
  return rejectWrite('modify');
}

export async function deletePartnerStoreIdentity(): Promise<IdentityWriteActionResult> {
  return rejectWrite('delete');
}

export function listPartnerStoreIdentityWriteOperations(): readonly IdentityWriteOperation[] {
  return IDENTITY_WRITE_OPERATIONS;
}
