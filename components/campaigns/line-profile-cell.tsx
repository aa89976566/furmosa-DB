import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatRelative } from '@/lib/format';
import {
  maskLineUserId,
  resolveLineDisplayName,
} from '@/lib/line/mask-user-id';
import { UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

export type LineProfileCellProps = {
  lineUserId: string;
  displayName?: string | null;
  pictureUrl?: string | null;
  syncedAt?: Date | string | null;
  /** 列表精簡；詳情可顯示上次同步 */
  showSyncedAt?: boolean;
  className?: string;
  size?: 'sm' | 'md';
};

/**
 * HQ 審核用 LINE 身分呈現：頭像／顯示名／遮罩 userId。
 * 不提供聊天／深連結；不渲染完整 Messaging API userId。
 */
export function LineProfileCell({
  lineUserId,
  displayName,
  pictureUrl,
  syncedAt,
  showSyncedAt = false,
  className,
  size = 'sm',
}: LineProfileCellProps) {
  const name = resolveLineDisplayName(displayName);
  const masked = maskLineUserId(lineUserId);
  const initial = name === '尚未取得 LINE 名稱' ? '?' : name.slice(0, 1);
  const avatarClass = size === 'md' ? 'h-10 w-10' : 'h-8 w-8';

  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <Avatar className={avatarClass} aria-hidden>
        {pictureUrl ? (
          <AvatarImage src={pictureUrl} alt="" referrerPolicy="no-referrer" />
        ) : null}
        <AvatarFallback className="bg-muted text-muted-foreground">
          {pictureUrl ? initial : <UserRound className="h-3.5 w-3.5" aria-hidden />}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate font-medium leading-tight" title={name}>
          {name}
        </div>
        <div
          className="font-mono text-[11px] leading-tight text-muted-foreground"
          title="已遮罩的 LINE userId"
        >
          {masked}
        </div>
        {showSyncedAt ? (
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {syncedAt
              ? `資料同步 ${formatRelative(syncedAt)}`
              : '尚未同步 LINE 資料'}
          </div>
        ) : null}
      </div>
    </div>
  );
}
