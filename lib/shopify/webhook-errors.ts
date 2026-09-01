export class ShopifyWebhookError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, status: number, retryable: boolean) {
    super(message);
    this.name = 'ShopifyWebhookError';
    this.status = status;
    this.retryable = retryable;
  }
}

export class ShopifyWebhookClientError extends ShopifyWebhookError {
  constructor(message: string, status = 400) {
    super(message, status, false);
    this.name = 'ShopifyWebhookClientError';
  }
}

export class ShopifyWebhookRetryableError extends ShopifyWebhookError {
  constructor(message: string) {
    super(message, 500, true);
    this.name = 'ShopifyWebhookRetryableError';
  }
}

export function isShopifyWebhookError(error: unknown): error is ShopifyWebhookError {
  return error instanceof ShopifyWebhookError;
}
