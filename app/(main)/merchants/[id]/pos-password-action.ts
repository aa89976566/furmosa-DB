'use server';

import { createMerchantPosUser, resetMerchantPosUserPassword } from './actions';
import {
  resetPosPasswordWithFeedbackUsing,
  createPosUserWithFeedbackUsing,
  type PosPasswordFeedbackState,
} from '@/lib/pos/password-feedback-service';

export type PosPasswordState = PosPasswordFeedbackState;

export async function createPosUserWithFeedback(
  _previous: PosPasswordState,
  formData: FormData,
): Promise<PosPasswordState> {
  return createPosUserWithFeedbackUsing(createMerchantPosUser, formData);
}

export async function resetPosPasswordWithFeedback(
  _previous: PosPasswordState,
  formData: FormData,
): Promise<PosPasswordState> {
  // Keep the existing admin, merchant ownership, validation and hashing checks.
  return resetPosPasswordWithFeedbackUsing(resetMerchantPosUserPassword, formData);
}
