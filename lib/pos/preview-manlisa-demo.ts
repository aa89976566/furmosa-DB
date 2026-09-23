export const PREVIEW_MANLISA_PATH = '/pos/preview/manlisa';

function enabled() {
  return process.env.VERCEL_ENV === 'preview'
    && process.env.PREVIEW_DEMO_LOGIN_ENABLED === 'true'
    && process.env.VERCEL_GIT_COMMIT_REF === 'codex/shipment-detail-reference-ux';
}

export function canUsePreviewManlisaDemo() {
  return enabled();
}
