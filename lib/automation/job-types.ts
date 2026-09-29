export const AUTOMATION_JOB_TYPES = {
  refillPaidLine: 'line.refill_paid',
  refillCompletedLine: 'line.refill_completed',
} as const;

export type AutomationJobType =
  (typeof AUTOMATION_JOB_TYPES)[keyof typeof AUTOMATION_JOB_TYPES];

export type RefillPaidPayload = { refillOrderId: string };
export type RefillCompletedPayload = {
  refillOrderId: string;
  pointsAwarded: boolean;
};
