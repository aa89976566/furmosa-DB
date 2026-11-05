import { readFileSync, writeFileSync } from 'node:fs';
import { runSmoke } from './production-smoke.mjs';

const targets = JSON.parse(readFileSync(new URL('../config/deployment-targets.json', import.meta.url), 'utf8'));
const report = await runSmoke({ origin: targets.production.origin });
const result = {
  checkedAt: new Date().toISOString(),
  origin: targets.production.origin,
  ...report,
};
writeFileSync('production-public-probe.json', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
process.exitCode = report.ok ? 0 : 1;
