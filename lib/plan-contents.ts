export type PlanContentItem = { name: string; weight?: string; note?: string };

export function parsePlanContents(raw: string | null | undefined): PlanContentItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is PlanContentItem => typeof x?.name === 'string');
  } catch {
    return [];
  }
}

export function formatPlanContents(items: PlanContentItem[]): string {
  return items.map((c) => (c.weight ? `${c.name}（${c.weight}）` : c.name)).join('、');
}
