import type { HomeTaskCard } from '@/lib/pos/home-tasks';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';

export function HomeTaskCardLink({ card }: { card: HomeTaskCard }) {
  return (
    <Link
      href={card.href}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
    >
      <Card className="border-neutral-200 shadow-sm">
        <CardContent className="flex min-h-[72px] items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="font-semibold text-zinc-900">{card.title}</p>
            <p className="mt-1 whitespace-pre-line text-base text-zinc-500">{card.subtitle}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-semibold tabular-nums text-zinc-900">{card.badge}</p>
            <p className="text-sm text-zinc-500">{card.badgeUnit}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
