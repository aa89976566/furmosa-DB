import { PosAccountMenu } from '@/components/pos/account-menu';
import type { PosAccount } from '@/lib/pos/account';

export function PosPageHeader({
  title,
  description,
  account,
}: {
  title: string;
  description?: string;
  account?: PosAccount | null;
}) {
  return (
    <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-5 md:px-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        {description ? (
          <p className="mt-1 text-base text-zinc-500">{description}</p>
        ) : null}
      </div>
      {account ? (
        <div className="shrink-0 md:hidden">
          <PosAccountMenu account={account} variant="header" />
        </div>
      ) : null}
    </header>
  );
}
