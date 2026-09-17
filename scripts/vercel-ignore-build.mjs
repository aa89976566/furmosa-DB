// Vercel is Preview-only. main is released exclusively by Railway.
// Vercel ignore command: exit 0 = skip build, exit 1 = continue build.
const ref = process.env.VERCEL_GIT_COMMIT_REF?.trim();
process.exit(ref === 'main' ? 0 : 1);
