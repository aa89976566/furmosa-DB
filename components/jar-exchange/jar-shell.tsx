import Link from 'next/link';
import { cn } from '@/lib/utils';

const TABS: { href: string; label: string; match?: string }[] = [
  { href: '/jar-exchange/ops', label: '營運台' },
  { href: '/jar-exchange/members', label: '換罐會員' },
  { href: '/jar-exchange/stores', label: '合作店家' },
  { href: '/jar-exchange/manage?tab=codes', label: '序號管理', match: 'codes' },
  { href: '/jar-exchange/manage?tab=ledger', label: '點數帳本', match: 'ledger' },
  { href: '/jar-exchange/manage?tab=rewards', label: '禮品兌換', match: 'rewards' },
];

export function JarShell({
  pathname,
  tab,
  title,
  description,
  actions,
  children,
}: {
  pathname: string;
  tab?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-white">
      <header className="border-b border-border/60 bg-card/80">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            換罐計畫
          </p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-navy">{title}</h1>
              {description ? (
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
          <nav className="mt-6 flex flex-wrap gap-1 border-b border-border/60">
            {TABS.map((t) => {
              const active = t.href.startsWith('/jar-exchange/ops')
                ? pathname.startsWith('/jar-exchange/ops')
                : t.href.startsWith('/jar-exchange/members')
                  ? pathname.startsWith('/jar-exchange/members')
                  : t.href.startsWith('/jar-exchange/stores')
                    ? pathname.startsWith('/jar-exchange/stores')
                    : pathname.startsWith('/jar-exchange/manage') && tab === t.match;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cn(
                    '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
                    active
                      ? 'border-primary font-medium text-navy'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}

export function JarPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-border/60 bg-card shadow-card', className)}>
      {children}
    </section>
  );
}
