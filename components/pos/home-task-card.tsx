import Link from 'next/link';
import type { HomeTaskCard } from '@/lib/pos/home-tasks';
import { Card, CardContent } from '@/components/ui/card';

export function HomeTaskCardLink({ card }: { card: HomeTaskCard }) {
  return (
    <Link href={card.href} className="block">
      <Card className="border-neutral-200 bg-white shadow-sm transition hover:border-zinc-300 hover:shadow-card">
        <CardContent className="flex min-h-[88px] items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="font-semibold text-zinc-900">{card.title}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-zinc-500">
              {card.subtitle}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-semibold tabular-nums text-zinc-900">{card.badge}</p>
            <p className="text-xs text-zinc-500">{card.badgeUnit}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
