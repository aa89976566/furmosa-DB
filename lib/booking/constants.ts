export const APPOINTMENT_STATUSES = [
  'requested',
  'confirmed',
  'reschedule_proposed',
  'cancelled',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Statuses that occupy a customer-visible slot on startsAt */
export const APPOINTMENT_OCCUPYING_STATUSES: AppointmentStatus[] = [
  'requested',
  'confirmed',
  'reschedule_proposed',
];

export const APPOINTMENT_CREATED_BY = ['customer', 'merchant', 'hq'] as const;
export type AppointmentCreatedBy = (typeof APPOINTMENT_CREATED_BY)[number];

export function appointmentStatusLabelForMerchant(status: string): string {
  switch (status) {
    case 'requested':
      return '待確認';
    case 'confirmed':
      return '已確認';
    case 'reschedule_proposed':
      return '已建議改時間';
    case 'cancelled':
      return '已取消';
    default:
      return '處理中';
  }
}

export function appointmentStatusLabelForCustomer(status: string): string {
  switch (status) {
    case 'requested':
      return '等待店家確認';
    case 'confirmed':
      return '已確認';
    case 'reschedule_proposed':
      return '店家建議改時間';
    case 'cancelled':
      return '已取消';
    default:
      return '處理中';
  }
}
