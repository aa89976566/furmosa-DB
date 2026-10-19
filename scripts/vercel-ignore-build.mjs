// Build the production main branch on Vercel; skip non-main branches.
// Vercel ignore command: exit 0 = skip build, exit 1 = continue build.
const ref = process.env.VERCEL_GIT_COMMIT_REF?.trim();
process.exit(ref === 'main' ? 1 : 0);
