import { Badge } from '@/components/ui/badge';
import { merchantTypeLabel, type MerchantType } from '@/lib/merchant-types';

export function MerchantTypeBadges({ types }: { types: MerchantType[] }) {
  if (!types.length) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex flex-wrap justify-end gap-1">
      {types.map((t) => (
        <Badge key={t} variant="secondary">
          {merchantTypeLabel[t]}
        </Badge>
      ))}
    </span>
  );
}
