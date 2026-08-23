import { spawnSync } from 'node:child_process';

const env = { ...process.env };
const isPreview = env.VERCEL_ENV === 'preview';

function run(command, args) {
  const result = spawnSync(command, args, {
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (isPreview) {
  env.DATABASE_URL ||= env.POSTGRES_PRISMA_URL || env.POSTGRES_URL;
  env.DIRECT_URL ||= env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL;

  if (!env.DATABASE_URL || !env.DIRECT_URL) {
    console.error('Preview 缺少獨立測試資料庫連線，停止建置。');
    process.exit(1);
  }

  console.log('Preview：套用測試資料庫 migration');
  run('npx', ['prisma', 'migrate', 'deploy']);
}

run('npx', ['prisma', 'generate']);

if (isPreview) {
  console.log('Preview：建立可重跑的換罐測試資料');
  run('npx', ['tsx', 'scripts/seed-refill-test-data.ts']);
}

run('npx', ['next', 'build']);
