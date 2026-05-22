/** Next.js redirect() 會 throw；client 端 await server action 時需重新拋出 */
export function isRedirectError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest: unknown }).digest === 'string' &&
    String((error as { digest: string }).digest).startsWith('NEXT_REDIRECT')
  );
}
