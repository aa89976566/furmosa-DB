import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';

export function PreviewDisclosure({
  summary,
  children,
}: {
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className={styles.disclosure}>
      <summary className={styles.disclosureSummary}>{summary}</summary>
      <div className={styles.disclosureBody}>{children}</div>
    </details>
  );
}
