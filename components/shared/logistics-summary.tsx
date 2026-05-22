import type { LogisticsInfo } from '@/lib/logistics-display';
import { MapPin, Phone, Truck } from 'lucide-react';

export function LogisticsSummary({
  logistics,
  compact = false,
}: {
  logistics: LogisticsInfo;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="space-y-0.5 text-xs">
        <div className="flex items-center gap-1 font-medium text-foreground">
          <Truck className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span>{logistics.carrierLabel}</span>
        </div>
        <div className="flex items-start gap-1 text-muted-foreground">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="line-clamp-2 break-words [overflow-wrap:anywhere]">
            {logistics.destination}
          </span>
        </div>
        <div className="text-muted-foreground">
          {logistics.contactName}
          {logistics.phone !== '—' ? ` · ${logistics.phone}` : ''}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-border/60 bg-muted/30 px-3 py-3 text-sm">
      <p className="flex items-center gap-2 font-semibold text-navy">
        <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
        {logistics.carrierLabel}
      </p>
      <p className="flex items-start gap-2 leading-relaxed">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 break-words [overflow-wrap:anywhere]">{logistics.destination}</span>
      </p>
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">{logistics.contactName}</span>
        {logistics.phone !== '—' ? (
          <span className="mt-1 block font-mono text-xs tabular-nums">
            <Phone className="mr-1 inline h-3.5 w-3.5" />
            {logistics.phone}
          </span>
        ) : null}
      </p>
    </div>
  );
}
