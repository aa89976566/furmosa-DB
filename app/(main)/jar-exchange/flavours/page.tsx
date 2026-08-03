import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { JarShell, JarPanel } from '@/components/jar-exchange/jar-shell';
import { ensureRefillPlanSeeded } from '@/lib/jar-exchange/refill-flavours';
import { formatFlavourLabel } from '@/lib/jar-exchange/refill-plan-content';
import { formatDateTime } from '@/lib/format';
import {
  copyRefillPeriodAction,
  setRefillStockAction,
  syncJarCatalogueAction,
  updateRefillPlanSettingsAction,
  upsertRefillFlavourAction,
} from './actions';

export const dynamic = 'force-dynamic';

export default async function RefillFlavoursAdminPage() {
  await ensureRefillPlanSeeded();
  const [settings, flavours, stores, stocks, txns, jarProducts] = await Promise.all([
    prisma.refillPlanSettings.findUnique({ where: { id: 'default' } }),
    prisma.refillFlavour.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        product: { select: { id: true, name: true, sku: true, productId: true } },
      },
    }),
    prisma.store.findMany({ orderBy: { name: 'asc' } }),
    prisma.merchantRefillStock.findMany({
      include: { store: true, flavour: true },
      orderBy: [{ store: { name: 'asc' } }, { flavour: { sortOrder: 'asc' } }],
    }),
    prisma.refillStockTxn.findMany({
      take: 30,
      orderBy: { createdAt: 'desc' },
      include: { flavour: true },
    }),
    prisma.product.findMany({
      where: { productCategory: 'JAR_EXCHANGE', status: 'active' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, sku: true, productId: true },
    }),
  ]);

  const unlinked = flavours.filter((f) => !f.productId).length;

  return (
    <JarShell
      pathname="/jar-exchange/flavours"
      title="換罐口味與庫存"
      description="口味＝本期目錄（LINE）；商品主檔＝叫貨／出貨身份。兩者必須對應同一套 SKU。"
    >
      <div className="space-y-6">
        <JarPanel>
          <div className="border-b border-border/60 px-5 py-4">
            <h2 className="text-base font-semibold text-navy">計劃設定</h2>
          </div>
          <div className="px-5 py-4">
            <form action={updateRefillPlanSettingsAction} className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                主視覺路徑
                <input
                  name="heroImageUrl"
                  defaultValue={
                    settings?.heroImageUrl ?? '/images/refill-plan/refill-flavours-v2.jpg'
                  }
                  className="mt-1 w-full rounded border px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                更新節奏文案
                <input
                  name="flavourUpdateNote"
                  defaultValue={settings?.flavourUpdateNote ?? '每兩週更新'}
                  className="mt-1 w-full rounded border px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                第一罐 NT$（顯示用；實收以系統常數為準）
                <input
                  name="firstJarPrice"
                  type="number"
                  defaultValue={settings?.firstJarPrice ?? 129}
                  className="mt-1 w-full rounded border px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                換罐 NT$（顯示用；實收以系統常數為準）
                <input
                  name="exchangePrice"
                  type="number"
                  defaultValue={settings?.exchangePrice ?? 99}
                  className="mt-1 w-full rounded border px-2 py-1.5"
                />
              </label>
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="rounded bg-[#C46A2F] px-3 py-1.5 text-sm text-white"
                >
                  儲存設定
                </button>
                <button
                  formAction={copyRefillPeriodAction}
                  className="rounded border border-[#2E231D] bg-[#FFFCF7] px-3 py-1.5 text-sm"
                >
                  開始新一期（複製庫存紀錄）
                </button>
                <button
                  formAction={syncJarCatalogueAction}
                  className="rounded border border-[#71836B] bg-[#FFFCF7] px-3 py-1.5 text-sm"
                >
                  同步口味 → 商品主檔
                </button>
              </div>
            </form>
            {settings?.updatedAt ? (
              <p className="mt-2 text-xs text-muted-foreground">
                最後更新：{formatDateTime(settings.updatedAt)}
                {unlinked > 0 ? ` · 尚有 ${unlinked} 個口味未連結商品` : ' · 口味皆已連結商品'}
              </p>
            ) : null}
          </div>
        </JarPanel>

        <JarPanel>
          <div className="border-b border-border/60 px-5 py-4">
            <h2 className="text-base font-semibold text-navy">口味主檔（本期目錄）</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              對應的商品會標成「換罐計畫」，店家 POS 叫貨「自己選」會列出這些 SKU。
            </p>
          </div>
          <div className="px-5 py-4">
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">代碼</th>
                    <th>名稱</th>
                    <th>克數</th>
                    <th>商品主檔</th>
                    <th>排序</th>
                    <th>啟用</th>
                    <th>期間</th>
                  </tr>
                </thead>
                <tbody>
                  {flavours.map((f) => (
                    <tr key={f.id} className="border-b align-top">
                      <td className="py-2 font-mono text-xs">{f.code}</td>
                      <td>{formatFlavourLabel(f.name, f.weightGrams)}</td>
                      <td>{f.weightGrams}g</td>
                      <td className="text-xs">
                        {f.product ? (
                          <Link
                            href={`/products/${f.product.id}`}
                            className="text-info hover:underline"
                          >
                            <span className="font-mono">{f.product.sku}</span>
                            <span className="mt-0.5 block text-muted-foreground">
                              {f.product.name}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-destructive">未連結</span>
                        )}
                      </td>
                      <td>{f.sortOrder}</td>
                      <td>{f.isActive ? '是' : '停用'}</td>
                      <td className="text-xs text-muted-foreground">
                        {f.availableFrom ? formatDateTime(f.availableFrom) : '—'}
                        {' ~ '}
                        {f.availableUntil ? formatDateTime(f.availableUntil) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form action={upsertRefillFlavourAction} className="grid gap-2 md:grid-cols-3">
              <input
                name="code"
                placeholder="代碼 e.g. beef-20"
                className="rounded border px-2 py-1.5"
                required
              />
              <input
                name="name"
                placeholder="名稱 e.g. 牛肉凍乾"
                className="rounded border px-2 py-1.5"
                required
              />
              <input
                name="weightGrams"
                type="number"
                placeholder="克數"
                className="rounded border px-2 py-1.5"
                required
              />
              <input
                name="sortOrder"
                type="number"
                placeholder="排序"
                defaultValue={0}
                className="rounded border px-2 py-1.5"
              />
              <input
                name="imageUrl"
                placeholder="圖片 URL（選填）"
                className="rounded border px-2 py-1.5"
              />
              <select name="productId" className="rounded border px-2 py-1.5" defaultValue="">
                <option value="">自動建立／對應商品主檔</option>
                {jarProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}（{p.sku}）
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input name="isActive" type="checkbox" defaultChecked />
                啟用
              </label>
              <input name="availableFrom" type="date" className="rounded border px-2 py-1.5" />
              <input name="availableUntil" type="date" className="rounded border px-2 py-1.5" />
              <button type="submit" className="rounded bg-[#71836B] px-3 py-1.5 text-sm text-white">
                新增／更新口味
              </button>
            </form>
          </div>
        </JarPanel>

        <JarPanel>
          <div className="border-b border-border/60 px-5 py-4">
            <h2 className="text-base font-semibold text-navy">合作店庫存</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              更新後會雙寫到對應寄賣店的 MerchantStock（若 Store↔Merchant 可對應），POS
              交付會從此扣庫存。
            </p>
          </div>
          <div className="px-5 py-4">
            <form action={setRefillStockAction} className="mb-4 grid gap-2 md:grid-cols-5">
              <select name="storeId" className="rounded border px-2 py-1.5" required defaultValue="">
                <option value="" disabled>
                  選擇店家
                </option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                name="flavourId"
                className="rounded border px-2 py-1.5"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  選擇口味
                </option>
                {flavours.map((f) => (
                  <option key={f.id} value={f.id}>
                    {formatFlavourLabel(f.name, f.weightGrams)}
                  </option>
                ))}
              </select>
              <input
                name="quantity"
                type="number"
                min={0}
                placeholder="數量"
                className="rounded border px-2 py-1.5"
                required
              />
              <label className="flex items-center gap-2 text-sm">
                <input name="isAvailable" type="checkbox" defaultChecked />
                可選
              </label>
              <button type="submit" className="rounded bg-[#C46A2F] px-3 py-1.5 text-sm text-white">
                更新庫存
              </button>
              <input
                name="note"
                placeholder="備註（選填）"
                className="md:col-span-5 rounded border px-2 py-1.5"
              />
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">店家</th>
                    <th>口味</th>
                    <th>數量</th>
                    <th>可選</th>
                    <th>更新時間</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-muted-foreground">
                        尚無店家庫存。請先設定各店數量；LINE 介紹會顯示全部啟用口味，並提醒依當期庫存為準。
                      </td>
                    </tr>
                  ) : (
                    stocks.map((s) => (
                      <tr key={s.id} className="border-b">
                        <td className="py-2">{s.store.name}</td>
                        <td>{formatFlavourLabel(s.flavour.name, s.flavour.weightGrams)}</td>
                        <td>{s.quantity}</td>
                        <td>{s.isAvailable ? '是' : '缺貨'}</td>
                        <td className="text-xs text-muted-foreground">
                          {formatDateTime(s.updatedAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </JarPanel>

        <JarPanel>
          <div className="border-b border-border/60 px-5 py-4">
            <h2 className="text-base font-semibold text-navy">庫存異動紀錄（最近 30 筆）</h2>
          </div>
          <ul className="space-y-1 px-5 py-4 text-sm">
            {txns.map((t) => (
              <li key={t.id} className="border-b py-1.5 text-muted-foreground">
                {formatDateTime(t.createdAt)} · {t.reason} · {t.flavour.name} · Δ{t.changeQty} →{' '}
                {t.quantityAfter}
                {t.note ? `（${t.note}）` : ''}
              </li>
            ))}
            {txns.length === 0 ? <li>尚無異動</li> : null}
          </ul>
        </JarPanel>
      </div>
    </JarShell>
  );
}
