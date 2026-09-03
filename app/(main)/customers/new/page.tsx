import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { CustomerForm } from '@/components/customers/customer-form';
import { ArrowLeft, ArrowRight, Store, UserRound } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function NewCustomerPage({ searchParams }: { searchParams: { kind?: string } }) {
  const creatingCustomer = searchParams.kind === 'customer';

  return (
    <>
      <PageHeader
        title={creatingCustomer ? '新增一般客戶' : '新增聯絡資料'}
        description={creatingCustomer ? '先填基本聯絡方式，其餘資料需要時再補。' : '先確認要建立一般客戶，還是會使用 POS 的合作店家。'}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/customers">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回列表
            </Link>
          </Button>
        }
      />
      <div className="p-4 sm:p-6">
        {creatingCustomer ? (
          <div className="mx-auto max-w-3xl space-y-4">
            <Link href="/customers/new" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> 重新選擇類型
            </Link>
            <SectionCard title="基本資料" description="姓名與電話會帶入新訂單；收件人仍可在每張訂單中修改。">
              <CustomerForm />
              <p className="mt-4 text-[11px] text-muted-foreground">客戶編號（furmosa-XXXX）會在儲存時自動產生。</p>
            </SectionCard>
          </div>
        ) : (
          <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
            <EntryCard
              href="/customers/new?kind=customer"
              icon={UserRound}
              title="一般客戶"
              description="官網、LINE、訂閱或一般購買的客人"
              points={['建立客戶與毛孩資料', '新增訂單時可直接選取']}
            />
            <EntryCard
              href="/merchants/new"
              icon={Store}
              title="合作店家"
              description="寄賣、販售、換罐合作或需要 POS 的店家"
              points={['店名與預設收貨人分開', '共用店家庫存、補貨與 POS']}
            />
          </div>
        )}
      </div>
    </>
  );
}

function EntryCard({ href, icon: Icon, title, description, points }: { href: string; icon: typeof UserRound; title: string; description: string; points: string[] }) {
  return (
    <Link href={href} className="group rounded-2xl border bg-card p-6 shadow-card transition hover:border-foreground/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted"><Icon className="h-5 w-5" /></div>
        <ArrowRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" />
      </div>
      <h2 className="mt-6 text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <ul className="mt-5 space-y-2 border-t pt-4 text-sm">
        {points.map(point => <li key={point}>✓ {point}</li>)}
      </ul>
    </Link>
  );
}
