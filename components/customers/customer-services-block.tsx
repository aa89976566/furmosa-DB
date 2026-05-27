import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/shared/section-card';
import { customerServiceTypeLabel, customerServiceStatusLabel } from '@/lib/jar-exchange/labels';
import { formatDate } from '@/lib/format';
import { Layers } from 'lucide-react';

export function CustomerServicesBlock({
  services,
}: {
  services: {
    serviceType: string;
    serviceStatus: string;
    startedAt: Date;
    endedAt: Date | null;
  }[];
}) {
  const active = services.filter((s) => s.serviceStatus === 'active');

  return (
    <SectionCard
      title="服務類型"
      description="可同時擁有多種服務"
      icon={Layers}
      tone="master"
    >
      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">尚無進行中的服務標記</p>
      ) : (
        <ul className="space-y-2">
          {active.map((s) => (
            <li
              key={s.serviceType}
              className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/10 px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-medium">
                  {customerServiceTypeLabel[s.serviceType] ?? s.serviceType}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  自 {formatDate(s.startedAt)}
                </p>
              </div>
              <Badge variant={s.serviceStatus === 'active' ? 'success' : 'muted'}>
                {customerServiceStatusLabel[s.serviceStatus] ?? s.serviceStatus}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
