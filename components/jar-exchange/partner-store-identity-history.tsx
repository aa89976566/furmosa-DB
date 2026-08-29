import { AddIdentityDecisionForm } from '@/components/jar-exchange/partner-store-identity-forms';
import { VERDICT_LABEL, type PartnerStoreHumanDecision } from '@/lib/jar-exchange/partner-store-identity-decisions';

function formatWhen(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('zh-TW', { hour12: false });
}

export function PartnerStoreIdentityHistory({
  records,
  merchantIds,
}: {
  records: PartnerStoreHumanDecision[];
  merchantIds: string[];
}) {
  return (
    <div className="px-5 py-4">
      <p className="text-sm text-navy">人工確認紀錄</p>
      <p className="mt-1 text-sm text-muted-foreground">
        新增一筆不必改程式。撤銷不會刪除原紀錄。
      </p>
      <div className="mt-4">
        <AddIdentityDecisionForm merchantIds={merchantIds} />
      </div>
      {records.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">目前沒有確認紀錄。</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">MER</th>
                <th className="py-2 pr-3 font-medium">舊 slug</th>
                <th className="py-2 pr-3 font-medium">判定</th>
                <th className="py-2 pr-3 font-medium">確認人</th>
                <th className="py-2 pr-3 font-medium">確認／撤銷</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {records.map((record) => (
                <tr key={record.id} className="align-top">
                  <td className="py-3 pr-3 font-mono text-xs">{record.merchantId}</td>
                  <td className="py-3 pr-3 font-mono text-xs">{record.legacySlug ?? '—'}</td>
                  <td className="py-3 pr-3">{VERDICT_LABEL[record.verdict]}</td>
                  <td className="py-3 pr-3">
                    <p>{record.decidedByAccount}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{record.rationale}</p>
                  </td>
                  <td className="py-3 pr-3 text-xs text-muted-foreground">
                    <p>確認 {formatWhen(record.decidedAt)}</p>
                    <p>建立 {formatWhen(record.createdAt)}</p>
                    <p>另一筆：{record.otherRecordDisposition}</p>
                    {record.revokedAt ? (
                      <p className="mt-1">
                        已撤銷 {formatWhen(record.revokedAt)} · {record.revokedByAccount} ·{' '}
                        {record.revokeReason}
                      </p>
                    ) : (
                      <p className="mt-1">有效</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
