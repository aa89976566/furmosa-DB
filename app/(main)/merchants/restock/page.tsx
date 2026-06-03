import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { RestockSubmitButton } from '@/components/merchants/restock-submit-button';
import { MerchantSelect } from '@/components/merchants/merchant-select';
import { MerchantRestockLogistics } from '@/components/merchants/merchant-restock-logistics';
import {
  MerchantField,
  MerchantFormActions,
  MerchantNotice,
  MerchantSection,
  MerchantWorkspace,
} from '@/components/merchants/merchant-ui';
import {
  listMerchantsForSelect,
  loadMerchantRestockProductOptions,
  loadMerchantShippingDefaults,
  resolveSelectedMerchantId,
} from '@/lib/merchant-operation-options';
import { restockMerchant } from '../[id]/actions';
import { RestockForm } from '../[id]/restock/restock-form';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MerchantsRestockPage({
  searchParams,
}: {
  searchParams?: { merchantId?: string };
}) {
  const merchants = await listMerchantsForSelect();
  const selectedMerchantId = resolveSelectedMerchantId(merchants, searchParams?.merchantId);
  const selectedMerchant = merchants.find((merchant) => merchant.id === selectedMerchantId);
  const [productOptions, shippingDefaults] = selectedMerchantId
    ? await Promise.all([
        loadMerchantRestockProductOptions(selectedMerchantId),
        loadMerchantShippingDefaults(selectedMerchantId),
      ])
    : [null, null];

  const submitStep = shippingDefaults ? 3 : 2;

  return (
    <>
      <PageHeader
        title="新增進貨"
        description="選擇店家後建立寄賣進貨出貨單"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/merchants">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回寄賣
            </Link>
          </Button>
        }
      />
      <MerchantWorkspace narrow>
        {merchants.length === 0 ? (
          <MerchantSection title="進貨" description="尚無可選店家">
            <p className="text-sm text-muted-foreground">請先新增店家。</p>
          </MerchantSection>
        ) : (
          <form action={restockMerchant} className="space-y-4">
            <input type="hidden" name="merchantId" value={selectedMerchantId} />

            <MerchantSection
              step={1}
              title="選擇店家與商品"
              description="先選店家，再填進貨品項。"
            >
              <div className="space-y-4">
                <MerchantField label="店家" required>
                  <MerchantSelect merchants={merchants} value={selectedMerchantId} />
                </MerchantField>
                {selectedMerchant ? (
                  <p className="text-xs text-muted-foreground">
                    目前：<span className="font-medium text-navy">{selectedMerchant.name}</span>
                    <span className="font-mono">（{selectedMerchant.merchantId}）</span>
                  </p>
                ) : null}
                <RestockForm key={selectedMerchantId} products={productOptions ?? []} />
              </div>
            </MerchantSection>

            {shippingDefaults && selectedMerchant ? (
              <MerchantSection step={2} title="物流與收件" description="帶入店家檔案，可為本次出貨調整。">
                <MerchantRestockLogistics
                  merchantId={selectedMerchantId}
                  merchantLabel={`${selectedMerchant.name}（${selectedMerchant.merchantId}）`}
                  defaults={shippingDefaults}
                />
              </MerchantSection>
            ) : null}

            <MerchantSection
              step={submitStep}
              title="備註與送出"
              description="送達後才會加到店家庫存。"
            >
              <div className="space-y-4">
                <MerchantField label="備註（選填）">
                  <input
                    id="note"
                    name="note"
                    type="text"
                    placeholder="補貨、首批寄賣…"
                    className="block w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </MerchantField>
                <MerchantNotice variant="info">
                  送出後進入出貨隊列；物流標記「送達」後庫存才會增加。
                </MerchantNotice>
                <MerchantFormActions>
                  <Button variant="outline" asChild>
                    <Link href="/merchants">取消</Link>
                  </Button>
                  <RestockSubmitButton />
                </MerchantFormActions>
              </div>
            </MerchantSection>
          </form>
        )}
      </MerchantWorkspace>
    </>
  );
}
