export const PREVIEW_ACTION_TONES = {
  addToCart: 'primary',
  viewRestock: 'secondary',
  openCart: 'primary',
  completeSalePreview: 'primary',
  completeSaleConfirm: 'primary',
  completeSaleCancel: 'secondary',
  cartQtyStep: 'quiet',
  removeCartLine: 'danger',
  dialogClose: 'secondary',
  requestRefund: 'secondary',
  refundConfirm: 'primary',
  refundCancel: 'secondary',
  addRestockLine: 'secondary',
  addAllRestock: 'secondary',
  submitRestock: 'primary',
  openGroomingVoucher: 'primary',
} as const;

export type PreviewActionId = keyof typeof PREVIEW_ACTION_TONES;
export type PreviewActionTone = (typeof PREVIEW_ACTION_TONES)[PreviewActionId];
