export const JAR_LINE_CAMPAIGN_RECIPIENT_ENTITY = 'jar-line-campaign-recipient';
export const JAR_LINE_CAMPAIGN_RUN_ENTITY = 'jar-line-campaign-run';

export function isTestJarMember(input: {
  name: string;
  customerId?: string | null;
  tags?: string | null;
}) {
  const labels = [input.name, input.customerId ?? ''].map((value) =>
    value.trim().toLowerCase(),
  );
  if (labels.some((value) => value === 'test' || value.startsWith('test-'))) {
    return true;
  }

  try {
    const tags = JSON.parse(input.tags ?? '[]');
    return Array.isArray(tags) && tags.some((tag) => String(tag).trim().toLowerCase() === 'test');
  } catch {
    return false;
  }
}
