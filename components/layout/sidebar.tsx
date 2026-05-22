'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { navGroups } from '@/lib/nav';
import { sectionToneStyles } from '@/lib/section-tone';
import { cn } from '@/lib/utils';
import { PawPrint } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/' || pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border/70 bg-card shadow-sm">
      <div className="flex h-16 items-center gap-3 border-b border-border/70 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <PawPrint className="h-5 w-5" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight text-navy">Furmosa</span>
          <span className="text-[11px] text-muted-foreground">HQ Admin</span>
        </div>
      </div>
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-6">
          {navGroups.map((group) => {
            const groupStyles = sectionToneStyles[group.tone];
            return (
              <div key={group.label}>
                <p
                  className={cn(
                    'mb-2 inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
                    groupStyles.chip,
                  )}
                >
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all',
                          active
                            ? cn('font-medium text-navy shadow-sm ring-1', groupStyles.sidebarActive)
                            : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-4 w-4',
                            active ? groupStyles.eyebrow : 'text-muted-foreground',
                          )}
                        />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </ScrollArea>
      <div className="border-t border-border/70 px-5 py-4 text-[11px] text-muted-foreground">
        <p>v0.1.0 · MVP</p>
        <p>© Furmosa 2026</p>
      </div>
    </aside>
  );
}
