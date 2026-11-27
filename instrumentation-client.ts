import posthog from 'posthog-js';

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (token && host) {
  posthog.init(token, {
    api_host: host,
    defaults: '2026-08-30',
    capture_exceptions: false,
    capture_performance: true,
    disable_session_recording: true,
  });
} else if (process.env.NODE_ENV === 'development') {
  console.error('[analytics] PostHog is disabled because its public configuration is missing.');
}
