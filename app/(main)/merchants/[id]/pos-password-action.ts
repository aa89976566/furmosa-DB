'use server';

import { resetMerchantPosUserPassword } from './actions';
import {
  resetPosPasswordWithFeedbackUsing,
  type PosPasswordFeedbackState,
} from '@/lib/pos/password-feedback-service';

export type PosPasswordState = PosPasswordFeedbackState;

export async function resetPosPasswordWithFeedback(
  _previous: PosPasswordState,
  formData: FormData,
): Promise<PosPasswordState> {
  // Keep the existing admin, merchant ownership, validation and hashing checks.
  return resetPosPasswordWithFeedbackUsing(resetMerchantPosUserPassword, formData);
}
