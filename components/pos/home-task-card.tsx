import Link from 'next/link';
import type { HomeTaskCard } from '@/lib/pos/home-tasks';
import { Card, CardContent } from '@/components/ui/card';

export function HomeTaskCardLink({ card }: { card: HomeTaskCard }) {
  return (
    <Link href={card.href} className="block">
      <Card className="shadow-card transition hover:border-primary/40">
        <CardContent className="flex min-h-[88px] items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="font-semibold text-navy">{card.title}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
              {card.subtitle}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-semibold tabular-nums text-primary">{card.badge}</p>
            <p className="text-xs text-muted-foreground">{card.badgeUnit}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
