export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.OUTREACH_WORKER_ENABLED === 'true'
      && process.env.RAILWAY_ENVIRONMENT_NAME === 'production') {
    const { startOutreachWorker } = await import('./lib/outreach/service');
    startOutreachWorker();
  }
}
