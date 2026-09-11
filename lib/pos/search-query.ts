/** Next.js represents repeated query parameters as an array; use the first value. */
export function posSearchQuery(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}
