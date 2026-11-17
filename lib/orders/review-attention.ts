import type { OmsIssueCode } from './oms';

/** Navigation only: never interpret translated messages as validation or approval rules. */
export function reviewAttentionTarget(code: OmsIssueCode): string {
  switch (code) {
    case 'RECIPIENT_MISSING': return 'recipient';
    case 'PHONE_MISSING': return 'phone';
    case 'ADDRESS_MISSING': return 'address';
    case 'SHIPPING_METHOD_UNKNOWN': return 'method';
    case 'PICKUP_STORE_MISSING': return 'storeName';
    case 'TEMPERATURE_UNKNOWN':
    case 'TEMPERATURE_CONFLICT': return 'temperature';
    case 'POSSIBLE_DUPLICATE': return 'duplicateConfirmed';
    case 'SKU_MISSING':
    case 'PRODUCT_UNMAPPED':
    case 'STOCK_UNKNOWN':
    case 'STOCK_INSUFFICIENT':
    case 'GIFT_REVIEW_REQUIRED': return 'products';
    default: return 'source';
  }
}
