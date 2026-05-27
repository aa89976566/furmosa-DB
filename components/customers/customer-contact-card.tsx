import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/shared/section-card';
import { InfoField } from '@/components/customers/customer-detail-ui';
import { formatDate } from '@/lib/format';
import { customerTypeLabel } from '@/lib/labels';
import { MessageCircle, AtSign, Phone, Mail, MapPin, Truck, PawPrint } from 'lucide-react';
import { resolvePetSpeciesLabel } from '@/lib/customers/pet-fields';

export function CustomerContactCard({
  customer,
  tags,
}: {
  customer: {
    customerId: string;
    type: string;
    phone: string | null;
    email: string | null;
    birthday: Date | null;
    address: string | null;
    lineUserId: string | null;
    lineDisplay: string | null;
    socialIg: string | null;
    socialFb: string | null;
    petSpecies: string | null;
    petSpeciesOther: string | null;
    petName: string | null;
    petAgeYears: number | null;
    petBirthday: Date | null;
    preferredShippingMethod: string | null;
    preferredCvsBrand: string | null;
    preferredCvsStoreId: string | null;
    preferredCvsStoreName: string | null;
    createdAt: Date;
  };
  tags: string[];
}) {
  const cvsLabel =
    customer.preferredCvsBrand === '711'
      ? '7-ELEVEN'
      : customer.preferredCvsBrand === 'familymart'
        ? '全家'
        : customer.preferredCvsBrand === 'hilife'
          ? '萊爾富'
          : customer.preferredCvsBrand;

  const lineText =
    customer.lineUserId || customer.lineDisplay
      ? customer.lineDisplay || customer.lineUserId
      : null;
  const petSpeciesLabel = resolvePetSpeciesLabel(customer.petSpecies, customer.petSpeciesOther);

  return (
    <SectionCard title="聯絡方式" tone="master">
      <div className="grid gap-4 sm:grid-cols-2">
        <InfoField label={<span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />電話</span>}>
          {customer.phone ? (
            <a href={`tel:${customer.phone}`} className="text-primary hover:underline">
              {customer.phone}
            </a>
          ) : (
            <span className="text-muted-foreground">未填寫</span>
          )}
        </InfoField>
        <InfoField label={<span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />Email</span>}>
          {customer.email ? (
            <a href={`mailto:${customer.email}`} className="break-all text-primary hover:underline">
              {customer.email}
            </a>
          ) : (
            <span className="text-muted-foreground">未填寫</span>
          )}
        </InfoField>
        <InfoField label={<span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />LINE</span>}>
          {lineText ? (
            <>
              <span className="font-medium">{lineText}</span>
              {customer.lineUserId ? (
                <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                  {customer.lineUserId}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground">未綁定</span>
          )}
        </InfoField>
        <InfoField label={<span className="inline-flex items-center gap-1"><AtSign className="h-3 w-3" />Instagram</span>}>
          {customer.socialIg ?? '—'}
        </InfoField>
        <InfoField
          label={<span className="inline-flex items-center gap-1"><PawPrint className="h-3 w-3" />毛孩</span>}
          className="sm:col-span-2"
        >
          {customer.petName || petSpeciesLabel || customer.petAgeYears !== null || customer.petBirthday ? (
            <div className="space-y-1">
              <p className="font-medium">
                {customer.petName ?? '未填名字'}
                {petSpeciesLabel ? <span className="ml-2 text-xs text-muted-foreground">({petSpeciesLabel})</span> : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {customer.petAgeYears !== null ? `年齡：約 ${customer.petAgeYears} 歲` : '年齡未填'}
                {customer.petBirthday ? ` · 生日 ${formatDate(customer.petBirthday)}` : ''}
              </p>
            </div>
          ) : (
            <span className="text-muted-foreground">未填寫</span>
          )}
        </InfoField>
        <InfoField label="類型">
          <Badge variant="secondary">{customerTypeLabel[customer.type] ?? customer.type}</Badge>
        </InfoField>
        <InfoField label="建檔">
          {formatDate(customer.createdAt)}
        </InfoField>
        <InfoField label={<span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />地址</span>} className="sm:col-span-2">
          {customer.address ?? <span className="text-muted-foreground">未填寫</span>}
        </InfoField>
        <InfoField label={<span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" />預設運送</span>} className="sm:col-span-2">
          {customer.preferredShippingMethod === 'convenience' ? (
            <div>
              <Badge variant="secondary">超商取貨</Badge>
              <p className="mt-1 text-xs text-muted-foreground">
                {[cvsLabel, customer.preferredCvsStoreName, customer.preferredCvsStoreId && `店號 ${customer.preferredCvsStoreId}`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          ) : customer.preferredShippingMethod === 'home' ? (
            <Badge variant="outline">宅配</Badge>
          ) : (
            <span className="text-muted-foreground">未設定</span>
          )}
        </InfoField>
        {tags.length > 0 ? (
          <InfoField label="標籤" className="sm:col-span-2">
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">
                  {t}
                </Badge>
              ))}
            </div>
          </InfoField>
        ) : null}
      </div>
    </SectionCard>
  );
}
