const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const token = required('GITHUB_TOKEN');
const repository = required('GITHUB_REPOSITORY');
const sha = required('RELEASE_SHA').toLowerCase();
const context = required('RAILWAY_STATUS_CONTEXT');
const timeoutMs = Number(process.env.RAILWAY_WAIT_TIMEOUT_MS ?? 1_200_000);
const started = Date.now();
const endpoint = `https://api.github.com/repos/${repository}/commits/${sha}/status`;

while (Date.now() - started < timeoutMs) {
  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'furmosa-production-release',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`GitHub commit status failed (${response.status})`);
  const payload = await response.json();
  const status = (payload.statuses ?? []).find((item) => item.context === context);
  if (status?.state === 'success') {
    const target = new URL(status.target_url);
    if (target.protocol !== 'https:' || target.hostname !== 'railway.com') {
      throw new Error('Railway success status has an unexpected target URL');
    }
    console.log(`Railway reported success for ${sha}`);
    process.exit(0);
  }
  if (status && ['failure', 'error'].includes(status.state)) {
    throw new Error(`Railway deployment reported ${status.state}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 15_000));
}
throw new Error('Timed out waiting for Railway deployment status');
