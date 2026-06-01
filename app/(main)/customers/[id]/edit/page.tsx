import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { CustomerForm } from '@/components/customers/customer-form';
import { prisma } from '@/lib/prisma';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

function toDateInput(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export default async function EditCustomerPage({ params }: { params: { id: string } }) {
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      customerId: true,
      name: true,
      type: true,
      phone: true,
      email: true,
      address: true,
      lineUserId: true,
      lineDisplay: true,
      preferredShippingMethod: true,
      preferredCvsBrand: true,
      preferredCvsStoreId: true,
      preferredCvsStoreName: true,
      petSpecies: true,
      petSpeciesOther: true,
      petName: true,
      petAgeYears: true,
      petBirthday: true,
    },
  });
  if (!customer) notFound();

  return (
    <>
      <PageHeader
        tone="master"
        title={`編輯客戶 · ${customer.name}`}
        description={
          <span className="font-mono text-xs tracking-wide text-foreground/70">
            {customer.customerId}
          </span>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/customers/${customer.id}`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回詳情
            </Link>
          </Button>
        }
      />
      <div className="p-6">
        <SectionCard title="基本資料">
          <CustomerForm
            customer={{
              id: customer.id,
              name: customer.name,
              type: customer.type,
              phone: customer.phone,
              email: customer.email,
              address: customer.address,
              lineUserId: customer.lineUserId,
              lineDisplay: customer.lineDisplay,
              preferredShippingMethod: customer.preferredShippingMethod,
              preferredCvsBrand: customer.preferredCvsBrand,
              preferredCvsStoreId: customer.preferredCvsStoreId,
              preferredCvsStoreName: customer.preferredCvsStoreName,
              pet: {
                petSpecies: customer.petSpecies,
                petSpeciesOther: customer.petSpeciesOther,
                petName: customer.petName,
                petAgeYears: customer.petAgeYears,
                petBirthday: toDateInput(customer.petBirthday),
              },
            }}
          />
        </SectionCard>
      </div>
    </>
  );
}
