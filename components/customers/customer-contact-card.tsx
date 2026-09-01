import { Badge } from '@/components/ui/badge';
import { InfoField } from '@/components/customers/customer-detail-ui';
import { formatDate } from '@/lib/format';
import { customerTypeLabel } from '@/lib/labels';
import { resolvePetSpeciesLabel } from '@/lib/customers/pet-fields';
import { maskLineUserId, resolvePetAgeYears } from '@/lib/customers/member-display';
import { AtSign, Mail, MapPin, MessageCircle, Phone, Truck } from 'lucide-react';

type CustomerContact = {
  id: string;
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
  petBreed: string | null;
  petAgeYears: number | null;
  petBirthday: Date | null;
  preferredShippingMethod: string | null;
  preferredCvsBrand: string | null;
  preferredCvsStoreId: string | null;
  preferredCvsStoreName: string | null;
  createdAt: Date;
};

function FlatPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export function CustomerContactCard({ customer, tags }: { customer: CustomerContact; tags: string[] }) {
  const cvsLabel =
    customer.preferredCvsBrand === '711'
      ? '7-ELEVEN'
      : customer.preferredCvsBrand === 'familymart'
        ? '全家'
        : customer.preferredCvsBrand === 'hilife'
          ? '萊爾富'
          : customer.preferredCvsBrand;
  const petSpeciesLabel = resolvePetSpeciesLabel(customer.petSpecies, customer.petSpeciesOther);
  const petAge = resolvePetAgeYears(customer.petAgeYears, customer.petBirthday);
  const maskedLineId = maskLineUserId(customer.lineUserId);
  const missingFields = [
    !customer.email && 'Email',
    !customer.address && '地址',
    !customer.preferredShippingMethod && '預設運送',
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <FlatPanel title="會員資料">
        <div className="grid gap-5 pt-5">
          <InfoField label={<span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />電話</span>}>
            {customer.phone ? <a href={`tel:${customer.phone}`} className="font-medium hover:underline">{customer.phone}</a> : <span className="text-muted-foreground">未填寫</span>}
          </InfoField>
          <InfoField label={<span className="inline-flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" />LINE</span>}>
            {customer.lineUserId || customer.lineDisplay ? (
              <div>
                <span className="font-medium">{customer.lineDisplay || 'LINE 已綁定'}</span>
                {maskedLineId ? <span className="mt-1 block font-mono text-[11px] text-muted-foreground">{maskedLineId}</span> : null}
              </div>
            ) : <span className="text-muted-foreground">未綁定</span>}
          </InfoField>
          <InfoField label={<span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />Email</span>}>
            {customer.email ? <a href={`mailto:${customer.email}`} className="break-all hover:underline">{customer.email}</a> : <span className="text-muted-foreground">未填寫</span>}
          </InfoField>
          <InfoField label={<span className="inline-flex items-center gap-1.5"><AtSign className="h-3.5 w-3.5" />Instagram</span>}>
            {customer.socialIg ?? <span className="text-muted-foreground">未填寫</span>}
          </InfoField>
          <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
            <InfoField label="類型"><Badge variant="outline" className="font-medium">{customerTypeLabel[customer.type] ?? customer.type}</Badge></InfoField>
            <InfoField label="建檔">{formatDate(customer.createdAt)}</InfoField>
          </div>
          {tags.length > 0 ? <div className="flex flex-wrap gap-1.5">{tags.map((tag) => <Badge key={tag} variant="outline" className="font-normal">{tag}</Badge>)}</div> : null}
        </div>
      </FlatPanel>

      <FlatPanel title="毛孩資料">
        <div className="pt-5">
          {customer.petName || petSpeciesLabel || customer.petBreed || customer.petBirthday ? (
            <>
              <p className="text-xl font-semibold">{customer.petName ?? '未填名字'}</p>
              <p className="mt-1 text-sm text-muted-foreground">{[petSpeciesLabel, customer.petBreed].filter(Boolean).join(' · ') || '種類與品種未填'}</p>
              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4">
                <InfoField label="年齡">{petAge !== null ? `約 ${petAge} 歲` : '未填寫'}</InfoField>
                <InfoField label="生日">{customer.petBirthday ? formatDate(customer.petBirthday) : '未填寫'}</InfoField>
              </div>
            </>
          ) : <p className="text-sm text-muted-foreground">尚未建立毛孩資料</p>}
        </div>
      </FlatPanel>

      <details className="rounded-2xl border border-border bg-card px-5">
        <summary className="cursor-pointer py-4 text-sm font-semibold">
          地址與配送
          {missingFields.length > 0 ? <span className="ml-2 font-normal text-muted-foreground">缺少 {missingFields.length} 項</span> : null}
        </summary>
        <div className="space-y-4 border-t border-border py-4">
          <InfoField label={<span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />地址</span>}>{customer.address ?? <span className="text-muted-foreground">未填寫</span>}</InfoField>
          <InfoField label={<span className="inline-flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" />預設運送</span>}>
            {customer.preferredShippingMethod === 'convenience' ? (
              <div><span>超商取貨</span><p className="mt-1 text-xs text-muted-foreground">{[cvsLabel, customer.preferredCvsStoreName, customer.preferredCvsStoreId && `店號 ${customer.preferredCvsStoreId}`].filter(Boolean).join(' · ')}</p></div>
            ) : customer.preferredShippingMethod === 'home' ? '宅配' : <span className="text-muted-foreground">未設定</span>}
          </InfoField>
        </div>
      </details>
    </div>
  );
}
