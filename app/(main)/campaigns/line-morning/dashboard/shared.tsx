import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  isFixtureCanonicalUrl,
  labelNewsStatus,
} from '@/lib/line/morning/admin-labels';
import { updateMorningContentStatusAction } from '../actions';

const STATUS_TONE: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  APPROVED: 'default',
  ARCHIVED: 'outline',
  AUTO_APPROVED: 'default',
  BLOCKED: 'destructive',
  REVIEW_REQUIRED: 'secondary',
  DRY_RUN: 'outline',
  SKIPPED: 'secondary',
  SENT: 'default',
  FAILED: 'destructive',
  PLANNED: 'default',
};

export function StatusLabel({ code }: { code: string }) {
  return (
    <span className="inline-flex flex-col gap-0.5">
      <Badge variant={STATUS_TONE[code] ?? 'outline'} className="w-fit">
        {labelNewsStatus(code)}
      </Badge>
      <span className="font-mono text-[10px] text-muted-foreground">{code}</span>
    </span>
  );
}

export function CodeHint({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[11px] text-muted-foreground">{children}</span>;
}

export function SourceLink({ url, approved }: { url: string; approved: boolean }) {
  if (!approved) {
    return (
      <p className="break-all text-xs text-muted-foreground">
        已阻擋項目不提供來源導引
        {isFixtureCanonicalUrl(url) ? (
          <span className="mt-0.5 block">Fixture 占位：{url}</span>
        ) : null}
      </p>
    );
  }
  const fixture = isFixtureCanonicalUrl(url);
  return (
    <div className="space-y-1 text-xs">
      {fixture ? (
        <Badge variant="outline" className="font-normal">
          Fixture 占位（非真新聞）
        </Badge>
      ) : null}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex break-all text-primary underline underline-offset-2"
      >
        查看原始來源
      </a>
      <CodeHint>{url}</CodeHint>
    </div>
  );
}

export function ContentActions({ id, status }: { id: string; status: string }) {
  return (
    <div
      className="flex flex-wrap gap-1"
      data-capability="capability-content-actions"
    >
      {status !== 'APPROVED' ? (
        <form action={updateMorningContentStatusAction}>
          <input type="hidden" name="contentId" value={id} />
          <input type="hidden" name="status" value="APPROVED" />
          <Button type="submit" size="sm" variant="outline">
            核准
          </Button>
        </form>
      ) : null}
      {status !== 'DRAFT' ? (
        <form action={updateMorningContentStatusAction}>
          <input type="hidden" name="contentId" value={id} />
          <input type="hidden" name="status" value="DRAFT" />
          <Button type="submit" size="sm" variant="ghost">
            回草稿
          </Button>
        </form>
      ) : null}
      {status !== 'ARCHIVED' ? (
        <form action={updateMorningContentStatusAction}>
          <input type="hidden" name="contentId" value={id} />
          <input type="hidden" name="status" value="ARCHIVED" />
          <Button type="submit" size="sm" variant="ghost">
            封存
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function PreviewSafetyBadges() {
  return (
    <div className="flex flex-wrap items-center gap-2" role="status" aria-label="Preview 安全狀態">
      <Badge variant="secondary">Preview 驗收</Badge>
      <Badge variant="outline">尚未正式啟用</Badge>
      <Badge variant="outline">不會發送 LINE</Badge>
    </div>
  );
}
