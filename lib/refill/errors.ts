export class RefillError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400,
  ) {
    super(message);
    this.name = 'RefillError';
  }
}

export function toRefillHttp(e: unknown): { status: number; body: { error: string; code?: string } } {
  if (e instanceof RefillError) {
    return { status: e.status, body: { error: e.message, code: e.code } };
  }
  console.error('[refill]', e);
  return { status: 500, body: { error: '系統忙碌中，請稍後再試。' } };
}
