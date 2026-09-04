import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  PackagePlus,
  ScanLine,
  ShoppingCart,
  ClipboardList,
  Activity,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const actions: { href: (id: string) => string; label: string; icon: LucideIcon; primary?: boolean }[] = [
  { href: (id) => `/merchants/${id}/adjust`, label: '清點庫存', icon: ScanLine, primary: true },
  { href: (id) => `/merchants/${id}/restock`, label: '建立補貨', icon: PackagePlus },
  { href: (id) => `/merchants/${id}/sale`, label: '建立訂單', icon: ShoppingCart },
  { href: (id) => `/merchants/${id}/shipments`, label: '訂單與出貨', icon: ClipboardList },
  { href: (id) => `/merchants/${id}/ledger`, label: '活動紀錄', icon: Activity },
];

function ActionButton({
  href,
  label,
  icon: Icon,
  primary,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
}) {
  if (primary) {
    return (
      <Button asChild className="h-auto w-full flex-col gap-2 rounded-xl py-4 shadow-sm">
        <Link href={href}>
          <Icon className="h-5 w-5" />
          <span className="text-xs font-semibold">{label}</span>
        </Link>
      </Button>
    );
  }

  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="h-auto w-full justify-start gap-2 rounded-lg px-3 py-2.5 text-left font-normal hover:bg-muted/70"
    >
      <Link href={href}>
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-xs text-navy">{label}</span>
      </Link>
    </Button>
  );
}

export function MerchantOperationsHub({ merchantId }: { merchantId: string }) {
  const primary = actions.filter((a) => a.primary);
  const secondary = actions.filter((a) => !a.primary);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {primary.map(({ href, label, icon, primary: isPrimary }) => (
          <ActionButton
            key={label}
            href={href(merchantId)}
            label={label}
            icon={icon}
            primary={isPrimary}
          />
        ))}
      </div>
      <div className="rounded-xl border border-border/70 bg-muted/20 p-1.5">
        <div className="grid grid-cols-2 gap-0.5 sm:grid-cols-3">
          {secondary.map(({ href, label, icon }) => (
            <ActionButton key={label} href={href(merchantId)} label={label} icon={icon} />
          ))}
        </div>
      </div>
    </div>
  );
}
