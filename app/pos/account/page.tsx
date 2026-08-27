import { requireMerchantSession } from '@/lib/merchant-auth';
import { PosShell } from '@/components/pos/pos-shell';
import { loadPosAccount } from '@/lib/pos/account';
import { storeHeading } from '@/lib/pos/store-display';
import { FURMOSA_CONTACT } from '@/lib/pos/contact';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = { title: '店家資料 · Furmosa' };
export const dynamic = 'force-dynamic';

export default async function PosAccountPage() {
  const session = await requireMerchantSession();
  const account = await loadPosAccount(session.merchantId, session.username);
  const heading = storeHeading({ name: account.storeName, city: account.storeCity });

  return (
    <PosShell storeName={account.storeName} account={account}>
      <div className="space-y-4 px-4 py-6 pr-16">
        <h1 className="text-xl font-semibold text-navy">店家資料</h1>
        <Card className="shadow-card">
          <CardContent className="space-y-3 p-5 text-sm">
            <Row label="店名" value={heading.brandLine} />
            {heading.branchLine ? <Row label="分店" value={heading.branchLine} /> : null}
            {account.contactName ? <Row label="聯絡人" value={account.contactName} /> : null}
            {account.phone ? <Row label="電話" value={account.phone} /> : null}
            {account.address ? <Row label="地址" value={account.address} /> : null}
            <Row label="店員帳號" value={account.username} />
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="space-y-2 p-5 text-sm">
            <p className="font-medium text-navy">聯絡匠寵</p>
            <a className="block min-h-[44px] text-primary" href={FURMOSA_CONTACT.lineUrl}>
              LINE {FURMOSA_CONTACT.lineId}
            </a>
            <a className="block min-h-[44px] text-primary" href={FURMOSA_CONTACT.webUrl}>
              {FURMOSA_CONTACT.webUrl.replace('https://', '')}
            </a>
          </CardContent>
        </Card>
      </div>
    </PosShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium text-navy">{value}</p>
    </div>
  );
}
