import Link from 'next/link';
import { loadJarWeekActivity } from '@/lib/jar-exchange/load-week-activity';
import { formatNumber } from '@/lib/format';

export async function DashboardJarWeekActivity() {
  const activity = await loadJarWeekActivity();

  return (
    <section
      aria-labelledby="week-jar-activity-title"
      className="rounded-2xl border border-border/70 bg-white p-5 shadow-card sm:p-6"
    >
      <div className="mb-5 h-1 w-10 rounded-full bg-[hsl(142_43%_31%)]" aria-hidden />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 id="week-jar-activity-title" className="text-lg font-semibold tracking-tight text-navy">
            本週換罐活動
          </h2>
          <p className="text-sm text-muted-foreground">
            {activity.rangeLabel}，最近 7 個日曆日含今天。時間皆為台灣時間（Asia/Taipei）。
          </p>
        </div>
        <Link
          href="/jar-exchange/manage?tab=ledger"
          className="text-sm font-medium text-[hsl(142_43%_31%)] underline-offset-4 hover:underline"
        >
          查看全部
        </Link>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-6 border-y border-border/70 py-5">
        <div>
          <dt className="text-sm text-muted-foreground">本週總換罐次數</dt>
          <dd className="mt-1 text-2xl font-semibold tracking-tight text-navy">
            {formatNumber(activity.totalExchanges)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">參與會員數</dt>
          <dd className="mt-1 text-2xl font-semibold tracking-tight text-navy">
            {formatNumber(activity.participantCount)}
          </dd>
        </div>
      </dl>

      {activity.rows.length === 0 ? (
        <p className="px-2 py-10 text-center text-sm text-muted-foreground">
          這 7 天還沒有換罐交易。序號返航或換罐完成寫進點數帳本後，會顯示在這裡。
        </p>
      ) : (
        <ol className="divide-y divide-border/60">
          {activity.rows.map((row) => (
            <li
              key={row.id}
              className="grid gap-1 py-4 sm:grid-cols-[11.5rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-4"
            >
              <time className="text-sm text-muted-foreground">{row.timeLabel} 台灣時間</time>
              <div className="min-w-0">
                {row.memberHref ? (
                  <Link href={row.memberHref} className="font-medium text-navy hover:underline">
                    {row.memberName}
                  </Link>
                ) : (
                  <p className="font-medium text-navy">{row.memberName}</p>
                )}
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {row.storeName ?? '未記錄合作店'}
                </p>
              </div>
              <p className="text-sm font-medium tabular-nums text-[hsl(142_43%_31%)]">
                {row.pointsChange > 0 ? '+' : ''}
                {formatNumber(row.pointsChange)} 點 · 換罐 {formatNumber(row.exchangeCount)} 次
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
