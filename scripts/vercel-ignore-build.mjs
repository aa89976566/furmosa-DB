// Vercel ignore command: exit 0 skips, exit 1 builds.
// Railway remains the only production target; unknown environments fail closed.
const ref = process.env.VERCEL_GIT_COMMIT_REF?.trim();
const preview = process.env.VERCEL_ENV === 'preview';
process.exit(preview && ref && ref !== 'main' ? 1 : 0);
