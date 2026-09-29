import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  formatMerchantCommercialDate,
  MERCHANT_COMMERCIAL_MODES,
  merchantCommercialModeLabel,
  merchantCommercialPeriodStatus,
  type MerchantCommercialMode,
} from '@/lib/merchants/commercial-module-input';
import { saveMerchantCommercialModule } from './actions';

type ModulePeriod = {
  id: string;
  mode: string;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
};

const descriptions: Record<MerchantCommercialMode, string> = {
  consignment: '店家代售商品，實際售出後才計算佣金。',
  wholesale: '店家以本單買斷價進貨，建立訂單時形成應收。',
  jar_exchange: '店家可執行換罐交付、點數與補貼流程。',
};

const statusLabel = {
  active: '使用中',
  upcoming: '尚未生效',
  ended: '已停用',
} as const;

function currentOrUpcomingPeriod(rows: ModulePeriod[], now: Date) {
  return rows.find((row) => merchantCommercialPeriodStatus(row, now) !== 'ended') ?? null;
}

export function MerchantCommercialModules({
  merchantId,
  modules,
  canEdit,
}: {
  merchantId: string;
  modules: ModulePeriod[];
  canEdit: boolean;
}) {
  const now = new Date();
  const today = formatMerchantCommercialDate(now);

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {MERCHANT_COMMERCIAL_MODES.map((mode) => {
        const rows = modules.filter((row) => row.mode === mode);
        const editable = currentOrUpcomingPeriod(rows, now);
        const latest = rows[0] ?? null;
        const shown = editable ?? latest;
        const status = shown ? merchantCommercialPeriodStatus(shown, now) : null;
        const startLocked = status === 'active';

        return (
          <form
            key={mode}
            action={saveMerchantCommercialModule}
            className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4"
          >
            <input type="hidden" name="merchantId" value={merchantId} />
            <input type="hidden" name="mode" value={mode} />
            {editable ? <input type="hidden" name="moduleId" value={editable.id} /> : null}

            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-navy">{merchantCommercialModeLabel[mode]}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {descriptions[mode]}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {status ? statusLabel[status] : '未設定'}
              </span>
            </div>

            {!editable && latest ? (
              <p className="rounded-lg bg-background px-3 py-2 text-xs text-muted-foreground">
                上次期間：{formatMerchantCommercialDate(latest.effectiveFrom)}～
                {formatMerchantCommercialDate(latest.effectiveUntil)}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <label className="text-xs font-medium text-muted-foreground">
                生效日
                {startLocked && editable ? (
                  <>
                    <Input
                      className="mt-1.5"
                      type="date"
                      disabled
                      value={formatMerchantCommercialDate(editable.effectiveFrom)}
                    />
                    <input
                      type="hidden"
                      name="effectiveFrom"
                      value={formatMerchantCommercialDate(editable.effectiveFrom)}
                    />
                  </>
                ) : (
                  <Input
                    className="mt-1.5"
                    name="effectiveFrom"
                    type="date"
                    required
                    disabled={!canEdit}
                    defaultValue={editable
                      ? formatMerchantCommercialDate(editable.effectiveFrom)
                      : today}
                  />
                )}
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                停用日（選填）
                <Input
                  className="mt-1.5"
                  name="effectiveUntil"
                  type="date"
                  disabled={!canEdit}
                  defaultValue={editable
                    ? formatMerchantCommercialDate(editable.effectiveUntil)
                    : ''}
                />
              </label>
            </div>

            {canEdit ? (
              <Button type="submit" size="sm" className="w-full">
                {editable ? '更新期間' : '啟用模組'}
              </Button>
            ) : (
              <p className="text-center text-xs text-muted-foreground">僅管理員可變更</p>
            )}
          </form>
        );
      })}
    </div>
  );
}
