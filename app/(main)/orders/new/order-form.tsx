'use client';

import Link from 'next/link';
import { useState, useMemo, useTransition, useEffect, useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/format';
import {
  Banknote,
  CheckCircle2,
  ChevronRight,
  Coins,
  CreditCard,
  HandCoins,
  Plus,
  Save,
  Store,
  Trash2,
  Truck,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { customerShippingDefaults } from '@/lib/customer-shipping-defaults';
import { merchantShippingToOrderFields } from '@/lib/merchant-shipping-defaults';
import {
  resolveOrderShipping,
  shippingMethodLabel,
  SHIPPING_FEE_CVS_711,
  SHIPPING_FEE_HOME_BLACK_CAT,
} from '@/lib/shipping-policy';
import { createOrder, updateOrder, searchCustomersForOrder, searchProductsForOrder } from '../actions';
import { isRedirectError } from '@/lib/redirect-error';
import type { OrderEditInitial } from '@/lib/orders/build-edit-initial';
import { CustomerSearchSelect } from '@/components/customers/customer-search-select';
import { ProductSearchSelect } from '@/components/products/product-search-select';
import { createCustomer } from '../../customers/actions';
import { OrderDiscountField } from '@/components/shared/order-discount-field';
import { variationLabel } from '@/lib/product-variations';
import { ORDER_LINE_UNIT_OPTIONS } from '@/lib/product-units';
import { resolveOrderItemUnitCost } from '@/lib/order-item-cost';

export type ProductTierOption = {
  id: string;
  weightGrams: number | null;
  unit: string;
  unitQty: number;
  price: number;
  cost: number | null;
  notes: string | null;
};
export type ProductOption = {
  id: string;
  name: string;
  sku: string;
  price: number;
  cost: number;
  unit: string;
  priceTiers: ProductTierOption[];
};

function tierLabel(t: ProductTierOption): string {
  return variationLabel(t);
}
export type MerchantOption = {
  id: string;
  name: string;
  merchantId: string;
  contactName: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  preferredCarrier: string | null;
  pickupStoreName: string | null;
};
export type CustomerOption = {
  id: string;
  name: string;
  customerId: string;
  phone: string | null;
  address: string | null;
  // 預設運輸偏好（建立客戶時填，可帶入新訂單）
  preferredShippingMethod: string | null;
  preferredCvsBrand: string | null;
  preferredCvsStoreId: string | null;
  preferredCvsStoreName: string | null;
};

type OrderType = 'merchant' | 'customer';
type CustomerSource = 'social' | 'line' | 'consignment';

type LineItem = {
  key: string;
  productId: string;
  tierId: string; // 規格選擇；無 tier 時為空字串
  quantity: number;
  unitPrice: number;
  unitCost: number;
  isGift: boolean;
  /** 勾選贈品前暫存售價，取消贈品時還原 */
  retailUnitPrice: number;
  weightGrams: number | null;
  unit: string | null;
};

const CUSTOMER_SOURCES: { value: CustomerSource; label: string; hint: string }[] = [
  { value: 'social', label: '社群', hint: 'IG / FB / 官網等網路通路' },
  { value: 'line', label: 'LINE', hint: 'LINE 官方帳號／私訊' },
  { value: 'consignment', label: '寄賣', hint: '透過寄賣店成交' },
];

function genKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function OrderLineItemsTable({
  title,
  hint,
  items,
  products,
  productMap,
  onSearchProducts,
  onSelectProduct,
  onSelectTier,
  onToggleGift,
  updateItem,
  addItem,
  removeItem,
}: {
  title: string;
  hint?: string;
  items: LineItem[];
  products: ProductOption[];
  productMap: Map<string, ProductOption>;
  onSearchProducts?: (query: string) => Promise<ProductOption[]>;
  onSelectProduct: (key: string, productId: string) => void;
  onSelectTier: (key: string, productId: string, tierId: string) => void;
  onToggleGift: (key: string, isGift: boolean) => void;
  updateItem: (key: string, patch: Partial<LineItem>) => void;
  addItem: () => void;
  removeItem: (key: string) => void;
}) {
  const hasAnyLine = items.some((it) => it.productId && it.quantity > 0);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{title}</div>
          {hint ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addItem}>
          <Plus className="mr-1 h-4 w-4" />
          新增一筆
        </Button>
      </div>

      <Table className="min-w-[760px] table-fixed">
        <colgroup>
          <col className="w-[30%]" />
          <col className="w-[20%]" />
          <col className="w-[11%]" />
          <col className="w-[13%]" />
          <col className="w-[13%]" />
          <col className="w-[7%]" />
          <col className="w-[6%]" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>商品</TableHead>
            <TableHead>規格</TableHead>
            <TableHead className="text-right">數量</TableHead>
            <TableHead className="text-right">單價</TableHead>
            <TableHead className="text-right">小計</TableHead>
            <TableHead className="text-center">贈品</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it) => {
            const buyerLineSubtotal = it.isGift ? 0 : it.quantity * it.unitPrice;
            const giftLineCost = it.isGift ? it.quantity * it.unitCost : 0;
            const prod = productMap.get(it.productId);
            const hasTiers = (prod?.priceTiers.length ?? 0) > 0;
            const rowRequired =
              !hasAnyLine && items.findIndex((row) => row.key === it.key) === 0;
            return (
              <TableRow key={it.key}>
                <TableCell>
                  <ProductSearchSelect
                    products={products}
                    value={it.productId}
                    onChange={(productId) => onSelectProduct(it.key, productId)}
                    onSearch={onSearchProducts}
                    required={rowRequired}
                  />
                  {prod ? (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      基礎單位：{prod.unit} · 售價 {formatCurrency(prod.price)}
                      {prod.cost > 0 ? ` · 成本 ${formatCurrency(prod.cost)}` : ''}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <input type="hidden" name="tierId" value={it.tierId} />
                  <input type="hidden" name="weightGrams" value={it.weightGrams ?? ''} />
                  <input type="hidden" name="lineIsGift" value={it.isGift ? '1' : '0'} />
                  {hasTiers ? (
                    <select
                      value={it.tierId}
                      onChange={(e) => onSelectTier(it.key, it.productId, e.target.value)}
                      className="block w-full rounded-md border bg-background px-2 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {prod!.priceTiers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {tierLabel(t)}
                          {t.notes ? ` · ${t.notes}` : ''}
                        </option>
                      ))}
                    </select>
                  ) : prod ? (
                    <select
                      name="unit"
                      value={it.unit ?? prod.unit}
                      onChange={(e) => updateItem(it.key, { unit: e.target.value })}
                      className="block w-full rounded-md border bg-background px-2 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {ORDER_LINE_UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                      {!ORDER_LINE_UNIT_OPTIONS.includes(
                        (it.unit ?? prod.unit) as (typeof ORDER_LINE_UNIT_OPTIONS)[number],
                      ) ? (
                        <option value={it.unit ?? prod.unit}>{it.unit ?? prod.unit}</option>
                      ) : null}
                    </select>
                  ) : (
                    <span className="text-xs text-muted-foreground">請先選商品</span>
                  )}
                </TableCell>
                <TableCell className="align-middle">
                  <Input
                    name="quantity"
                    type="number"
                    min={1}
                    step={1}
                    value={it.quantity}
                    onChange={(e) =>
                      updateItem(it.key, {
                        quantity: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    required={rowRequired && Boolean(it.productId)}
                    className="h-9 min-w-[4.5rem] text-right tabular-nums"
                  />
                </TableCell>
                <TableCell className="align-middle">
                  <Input
                    name="unitPrice"
                    type="number"
                    min={0}
                    step="0.01"
                    value={it.isGift ? 0 : it.unitPrice}
                    readOnly={it.isGift}
                    onChange={(e) =>
                      updateItem(it.key, {
                        unitPrice: Math.max(0, Number(e.target.value) || 0),
                        retailUnitPrice: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    required={rowRequired && Boolean(it.productId) && !it.isGift}
                    className="h-9 min-w-[5.5rem] text-right tabular-nums disabled:opacity-60"
                  />
                  {it.isGift && it.retailUnitPrice > 0 ? (
                    <p className="mt-0.5 text-[10px] text-muted-foreground line-through">
                      售價 {formatCurrency(it.retailUnitPrice)}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {it.isGift ? (
                    <div className="space-y-0.5">
                      <Badge variant="secondary" className="font-normal">
                        贈品
                      </Badge>
                      <div className="text-[11px] text-warning">
                        成本 {formatCurrency(giftLineCost)}
                      </div>
                    </div>
                  ) : (
                    formatCurrency(buyerLineSubtotal)
                  )}
                </TableCell>
                <TableCell className="text-center align-middle">
                  <input
                    type="checkbox"
                    checked={it.isGift}
                    disabled={!it.productId}
                    title="贈品不計入買家應付，計入公司成本"
                    className="h-4 w-4 rounded border-input"
                    onChange={(e) => onToggleGift(it.key, e.target.checked)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(it.key)}
                    disabled={items.length <= 1}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}

export function OrderForm({
  merchants,
  customers: initialCustomers,
  products,
  edit,
  initialMerchantId,
}: {
  merchants: MerchantOption[];
  customers: CustomerOption[];
  products: ProductOption[];
  edit?: OrderEditInitial;
  initialMerchantId?: string;
}) {
  const isEdit = Boolean(edit);
  const [formStep, setFormStep] = useState(initialMerchantId ? 2 : 1);
  const [orderType, setOrderType] = useState<OrderType>(
    edit?.orderType ?? (initialMerchantId ? 'merchant' : 'customer'),
  );
  const [customerSource, setCustomerSource] = useState<CustomerSource>(
    edit?.customerSource ?? 'social',
  );
  const [customerId, setCustomerId] = useState<string>(edit?.customerId ?? '');
  const [merchantId, setMerchantId] = useState<string>(
    edit?.merchantId ?? initialMerchantId ?? '',
  );
  const selectedMerchant = useMemo(
    () => merchants.find((m) => m.id === merchantId),
    [merchants, merchantId],
  );
  const [items, setItems] = useState<LineItem[]>(
    edit?.items ?? [
      {
        key: genKey(),
        productId: '',
        tierId: '',
        quantity: 1,
        unitPrice: 0,
        unitCost: 0,
        isGift: false,
        retailUnitPrice: 0,
        weightGrams: null,
        unit: null,
      },
    ],
  );
  const [discount, setDiscount] = useState<number>(edit?.discount ?? 0);
  const [shippingFeeType, setShippingFeeType] = useState<
    'free' | 'prepaid' | 'unpaid' | 'cod'
  >(edit?.shippingFeeType ?? 'unpaid');
  const [paymentStatus, setPaymentStatus] = useState<
    'unpaid' | 'partial' | 'paid' | 'cod' | 'refunded'
  >(edit?.paymentStatus ?? 'unpaid');
  const [recipientName, setRecipientName] = useState<string>(edit?.recipientName ?? '');
  const [recipientPhone, setRecipientPhone] = useState<string>(edit?.recipientPhone ?? '');
  const [shippingMethod, setShippingMethod] = useState<'home' | 'convenience' | 'delivery'>(
    edit?.shippingMethod ?? 'home',
  );
  const [cvsBrand, setCvsBrand] = useState<string>(edit?.cvsBrand ?? '711');
  const [cvsStoreName, setCvsStoreName] = useState<string>(edit?.cvsStoreName ?? '');
  const [shippingAddress, setShippingAddress] = useState<string>(edit?.shippingAddress ?? '');
  const [note, setNote] = useState<string>(edit?.note ?? '');

  // 客戶／商品清單（種子 + typeahead 合併）
  const [customers, setCustomers] = useState<CustomerOption[]>(initialCustomers);
  const [productCatalog, setProductCatalog] = useState<ProductOption[]>(products);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    lineDisplay: '',
    type: 'individual' as 'individual' | 'business',
    // 預設運輸偏好（建立客戶時就填）
    preferredShippingMethod: '' as '' | 'home' | 'convenience',
    preferredCvsBrand: '711' as string,
    preferredCvsStoreId: '',
    preferredCvsStoreName: '',
  });
  const [creatingCustomer, startCreateCustomer] = useTransition();

  const productMap = useMemo(
    () => new Map(productCatalog.map((p) => [p.id, p])),
    [productCatalog],
  );

  const mergeCustomers = useCallback((rows: CustomerOption[]) => {
    setCustomers((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]));
      for (const row of rows) map.set(row.id, row);
      return [...map.values()];
    });
  }, []);

  const mergeProducts = useCallback((rows: ProductOption[]) => {
    setProductCatalog((prev) => {
      const map = new Map(prev.map((p) => [p.id, p]));
      for (const row of rows) map.set(row.id, row);
      return [...map.values()];
    });
  }, []);

  const handleSearchCustomers = useCallback(
    async (query: string) => {
      const rows = await searchCustomersForOrder(query);
      mergeCustomers(rows);
      return rows;
    },
    [mergeCustomers],
  );

  const handleSearchProducts = useCallback(
    async (query: string) => {
      const rows = await searchProductsForOrder(query);
      mergeProducts(rows);
      return rows;
    },
    [mergeProducts],
  );

  const hasValidLines = useMemo(
    () => items.some((it) => it.productId && it.quantity > 0),
    [items],
  );

  const subtotal = useMemo(
    () =>
      items.reduce(
        (s, it) => (it.isGift ? s : s + it.quantity * it.unitPrice),
        0,
      ),
    [items],
  );
  const giftCostTotal = useMemo(
    () =>
      items.reduce(
        (s, it) => (it.isGift ? s + it.quantity * it.unitCost : s),
        0,
      ),
    [items],
  );
  const shippingResolved = useMemo(
    () =>
      resolveOrderShipping({
        shippingFeeType,
        shippingMethod,
        cvsBrand,
      }),
    [shippingFeeType, shippingMethod, cvsBrand],
  );
  const total = Math.max(0, subtotal - discount + shippingResolved.shippingFee);

  const showMerchantOptional =
    orderType === 'customer' && customerSource === 'consignment';
  const buyerSelected = orderType === 'customer' ? Boolean(customerId) : Boolean(merchantId);

  function updateItem(key: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }
  function linePricing(
    p: ProductOption,
    tierId: string,
  ): { unitPrice: number; unitCost: number; weightGrams: number | null; unit: string | null; tierId: string } {
    if (p.priceTiers.length > 0) {
      const t = p.priceTiers.find((x) => x.id === tierId) ?? p.priceTiers[0];
      return {
        tierId: t.id,
        unitPrice: t.price,
        unitCost: resolveOrderItemUnitCost(p, t.id),
        weightGrams: t.weightGrams,
        unit: t.unit,
      };
    }
    return {
      tierId: '',
      unitPrice: p.price,
      unitCost: resolveOrderItemUnitCost(p),
      weightGrams: null,
      unit: p.unit,
    };
  }

  function onSelectProduct(key: string, productId: string) {
    const p = productMap.get(productId);
    const current = items.find((it) => it.key === key);
    if (!p) {
      updateItem(key, {
        productId,
        tierId: '',
        unitPrice: 0,
        unitCost: 0,
        retailUnitPrice: 0,
        weightGrams: null,
        unit: null,
      });
      return;
    }
    const pricing = linePricing(p, p.priceTiers[0]?.id ?? '');
    const isGift = current?.isGift ?? false;
    updateItem(key, {
      productId,
      ...pricing,
      unitPrice: isGift ? 0 : pricing.unitPrice,
      retailUnitPrice: pricing.unitPrice,
    });
  }
  function onSelectTier(key: string, productId: string, tierId: string) {
    const p = productMap.get(productId);
    if (!p) {
      updateItem(key, { tierId: '' });
      return;
    }
    const pricing = linePricing(p, tierId);
    const current = items.find((it) => it.key === key);
    const isGift = current?.isGift ?? false;
    updateItem(key, {
      ...pricing,
      unitPrice: isGift ? 0 : pricing.unitPrice,
      retailUnitPrice: pricing.unitPrice,
    });
  }
  function onToggleGift(key: string, isGift: boolean) {
    const it = items.find((x) => x.key === key);
    if (!it) return;
    if (isGift) {
      updateItem(key, {
        isGift: true,
        retailUnitPrice: it.unitPrice > 0 ? it.unitPrice : it.retailUnitPrice,
        unitPrice: 0,
      });
    } else {
      updateItem(key, {
        isGift: false,
        unitPrice: it.retailUnitPrice > 0 ? it.retailUnitPrice : it.unitPrice,
      });
    }
  }
  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        key: genKey(),
        productId: '',
        tierId: '',
        quantity: 1,
        unitPrice: 0,
        unitCost: 0,
        isGift: false,
        retailUnitPrice: 0,
        weightGrams: null,
        unit: null,
      },
    ]);
  }
  function removeItem(key: string) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((it) => it.key !== key)));
  }

  function applyCustomerPreference(c: CustomerOption) {
    const shipping = customerShippingDefaults(c);
    setRecipientName(shipping.recipientName);
    setRecipientPhone(shipping.recipientPhone);

    // 1. 運輸方式：客戶有偏好就切過去
    if (c.preferredShippingMethod === 'convenience') {
      setShippingMethod('convenience');
      if (c.preferredCvsBrand) setCvsBrand(c.preferredCvsBrand);
      if (c.preferredCvsStoreName) setCvsStoreName(c.preferredCvsStoreName);
      setShippingAddress('');
    } else if (c.preferredShippingMethod === 'home') {
      setShippingMethod('home');
      if (c.address) setShippingAddress(c.address);
    } else if (c.address) {
      // 沒設定偏好但有地址 → 預設宅配 + 帶地址
      if (!shippingAddress) setShippingAddress(c.address);
    }
  }

  function applyMerchantShipping(m: MerchantOption) {
    const fields = merchantShippingToOrderFields(m);
    setRecipientName(fields.recipientName);
    setRecipientPhone(fields.recipientPhone);
    setShippingMethod(fields.shippingMethod);
    setCvsBrand(fields.cvsBrand);
    setCvsStoreName(fields.cvsStoreName);
    setShippingAddress(fields.shippingAddress);
  }

  function onMerchantChange(id: string) {
    setMerchantId(id);
    const m = merchants.find((x) => x.id === id);
    if (m) applyMerchantShipping(m);
  }

  useEffect(() => {
    if (isEdit) return;
    if (orderType === 'merchant' && selectedMerchant) {
      applyMerchantShipping(selectedMerchant);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderType, isEdit, selectedMerchant]);

  function onCustomerChange(id: string) {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    if (c) applyCustomerPreference(c);
  }

  function submitNewCustomer() {
    if (!newCustomer.name.trim()) {
      alert('客戶姓名為必填');
      return;
    }
    startCreateCustomer(async () => {
      try {
        const created = await createCustomer({
          name: newCustomer.name,
          type: newCustomer.type,
          phone: newCustomer.phone,
          email: newCustomer.email,
          address:
            newCustomer.preferredShippingMethod === 'convenience'
              ? null
              : newCustomer.address,
          lineDisplay: newCustomer.lineDisplay,
          preferredShippingMethod: newCustomer.preferredShippingMethod || null,
          preferredCvsBrand:
            newCustomer.preferredShippingMethod === 'convenience'
              ? newCustomer.preferredCvsBrand
              : null,
          preferredCvsStoreId: null,
          preferredCvsStoreName:
            newCustomer.preferredShippingMethod === 'convenience'
              ? newCustomer.preferredCvsStoreName
              : null,
        });
        // 把新客戶推到下拉列表頂端、自動選中
        setCustomers((prev) => [created, ...prev]);
        setCustomerId(created.id);
        // 自動把客戶的運輸偏好套用到訂單
        applyCustomerPreference(created);
        // 收起 form 並清空
        setShowNewCustomer(false);
        setNewCustomer({
          name: '',
          phone: '',
          email: '',
          address: '',
          lineDisplay: '',
          type: 'individual',
          preferredShippingMethod: '',
          preferredCvsBrand: '711',
          preferredCvsStoreId: '',
          preferredCvsStoreName: '',
        });
      } catch (e) {
        alert(e instanceof Error ? e.message : '新增客戶失敗');
      }
    });
  }

  return (
    <form
      action={async (formData) => {
        if (!recipientName.trim()) {
          alert('請填寫收件人姓名');
          return;
        }
        if (!hasValidLines) {
          alert('請至少新增一筆商品明細');
          return;
        }
        try {
          if (isEdit && edit) {
            formData.set('orderId', edit.orderId);
            await updateOrder(formData);
          } else {
            await createOrder(formData);
          }
        } catch (e) {
          if (isRedirectError(e)) throw e;
          alert(e instanceof Error ? e.message : isEdit ? '儲存訂單失敗' : '建立訂單失敗');
        }
      }}
      className="space-y-6"
    >
      <input type="hidden" name="shippingMethod" value={shippingMethod} />
      <input type="hidden" name="orderType" value={orderType} />
      <input type="hidden" name="customerSource" value={customerSource} />
      <input type="hidden" name="shippingFeeType" value={shippingFeeType} />
      <input type="hidden" name="shippingFee" value={shippingResolved.shippingFee} />
      <input type="hidden" name="paymentStatus" value={paymentStatus} />
      {isEdit && edit ? <input type="hidden" name="orderId" value={edit.orderId} /> : null}

      <OrderProgress step={formStep} />

      {/* Step 1: 訂單類型 */}
      <section hidden={formStep !== 1} className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
          選擇訂單對象
        </h2>
        {isEdit ? (
          <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            編輯模式無法變更訂單類型（
            {orderType === 'customer' ? '客戶訂單' : '寄賣店家訂單'}）
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <TypeCard
              active={orderType === 'customer'}
              icon={<User className="h-5 w-5" />}
              title="個人客戶"
              desc="一般消費者訂單"
              onClick={() => setOrderType('customer')}
            />
            <TypeCard
              active={orderType === 'merchant'}
              icon={<Store className="h-5 w-5" />}
              title="合作店家"
              desc="店家進貨或寄賣補貨"
              onClick={() => setOrderType('merchant')}
            />
          </div>
        )}
        <WizardActions onNext={() => setFormStep(2)} />
      </section>

      {/* Step 2A: 客戶模式 */}
      {orderType === 'customer' && (
        <section hidden={formStep !== 2} className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            選擇客戶
          </h2>

          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">
              訂單來源 <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CUSTOMER_SOURCES.map((source) => (
                <button
                  key={source.value}
                  type="button"
                  disabled={isEdit}
                  onClick={() => setCustomerSource(source.value)}
                  className={`min-h-10 rounded-lg border px-3 text-sm font-medium ${
                    customerSource === source.value
                      ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                      : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300'
                  }`}
                >
                  {source.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-[11px] text-muted-foreground">
                客戶 <span className="text-destructive">*</span>
              </label>
              <ToggleNewCustomerButton
                open={showNewCustomer}
                onToggle={() => setShowNewCustomer((v) => !v)}
              />
            </div>

            {showNewCustomer ? (
              <>
                <input type="hidden" name="customerId" value={customerId} />
                <NewCustomerPanel
                  value={newCustomer}
                  onChange={(v) => setNewCustomer(v)}
                  onSubmit={submitNewCustomer}
                  onCancel={() => setShowNewCustomer(false)}
                  pending={creatingCustomer}
                />
              </>
            ) : (
              <CustomerSearchSelect
                customers={customers}
                value={customerId}
                onChange={onCustomerChange}
                onSearch={handleSearchCustomers}
                required
              />
            )}
          </div>

          {showMerchantOptional && (
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">
                透過哪家寄賣店成交（選填）
              </label>
              <select
                name="merchantId"
                value={merchantId}
                onChange={(e) => onMerchantChange(e.target.value)}
                className="block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— 不指定 —</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.merchantId})
                  </option>
                ))}
              </select>
            </div>
          )}
          <WizardActions
            onBack={() => setFormStep(1)}
            onNext={() => setFormStep(3)}
            nextDisabled={!buyerSelected}
          />
        </section>
      )}

      {/* Step 2B: 寄賣店家模式 */}
      {orderType === 'merchant' && (
        <section hidden={formStep !== 2} className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            選擇合作店家
          </h2>

          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">
              寄賣店家 <span className="text-destructive">*</span>
            </label>
            <select
              name="merchantId"
              value={merchantId}
              onChange={(e) => onMerchantChange(e.target.value)}
              required
              className="block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— 選擇寄賣店 —</option>
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.merchantId})
                </option>
              ))}
            </select>
          </div>

          <Button variant="outline" asChild className="w-full border-neutral-300 text-neutral-950 hover:bg-neutral-100 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-900">
            <Link href="/merchants/new?returnTo=/orders/new">
              <Store className="mr-2 h-4 w-4" />
              新增合作店家
            </Link>
          </Button>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-[11px] text-muted-foreground">
                買家客戶（選填，若知道誰買的）
              </label>
              <ToggleNewCustomerButton
                open={showNewCustomer}
                onToggle={() => setShowNewCustomer((v) => !v)}
              />
            </div>
            {showNewCustomer ? (
              <>
                <input type="hidden" name="customerId" value={customerId} />
                <NewCustomerPanel
                  value={newCustomer}
                  onChange={(v) => setNewCustomer(v)}
                  onSubmit={submitNewCustomer}
                  onCancel={() => setShowNewCustomer(false)}
                  pending={creatingCustomer}
                />
              </>
            ) : (
              <CustomerSearchSelect
                customers={customers}
                value={customerId}
                onChange={onCustomerChange}
                onSearch={handleSearchCustomers}
                allowEmpty
                emptyLabel="— 不指定 —"
                placeholder="搜尋買家（選填）…"
              />
            )}
          </div>
          <WizardActions
            onBack={() => setFormStep(1)}
            onNext={() => setFormStep(3)}
            nextDisabled={!buyerSelected}
          />
        </section>
      )}

      {/* Step 3: 商品明細 */}
      <div hidden={formStep !== 3} className="space-y-4">
        <OrderLineItemsTable
          title="新增商品"
          items={items}
          products={productCatalog}
          productMap={productMap}
          onSearchProducts={handleSearchProducts}
          onSelectProduct={onSelectProduct}
          onSelectTier={onSelectTier}
          onToggleGift={onToggleGift}
          updateItem={updateItem}
          addItem={addItem}
          removeItem={removeItem}
        />
        <WizardActions
          onBack={() => setFormStep(2)}
          onNext={() => setFormStep(4)}
          nextDisabled={!hasValidLines}
        />
      </div>

      {/* Step 4: 金額 + 出貨資訊 */}
      <section hidden={formStep !== 4} className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
          確認訂單
        </h2>

        <FieldInline label="運費類型">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <FeeTypeCard
              active={shippingFeeType === 'free'}
              icon={<Truck className="h-4 w-4" />}
              title="包郵"
              onClick={() => setShippingFeeType('free')}
            />
            <FeeTypeCard
              active={shippingFeeType === 'prepaid'}
              icon={<CheckCircle2 className="h-4 w-4" />}
              title="已付費"
              onClick={() => setShippingFeeType('prepaid')}
            />
            <FeeTypeCard
              active={shippingFeeType === 'unpaid'}
              icon={<Coins className="h-4 w-4" />}
              title="不包郵"
              onClick={() => setShippingFeeType('unpaid')}
            />
            <FeeTypeCard
              active={shippingFeeType === 'cod'}
              icon={<HandCoins className="h-4 w-4" />}
              title="運費貨到付"
              onClick={() => setShippingFeeType('cod')}
            />
          </div>
        </FieldInline>

        {/* 付款狀態 */}
        <FieldInline label="付款狀態">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <PayCard
              active={paymentStatus === 'unpaid'}
              icon={<Banknote className="h-4 w-4" />}
              title="未付款"
              desc="尚未收到貨款"
              onClick={() => setPaymentStatus('unpaid')}
            />
            <PayCard
              active={paymentStatus === 'paid'}
              icon={<CreditCard className="h-4 w-4" />}
              title="已付款"
              desc="貨款已收齊（轉帳 / 信用卡）"
              onClick={() => setPaymentStatus('paid')}
            />
            <PayCard
              active={paymentStatus === 'cod'}
              icon={<HandCoins className="h-4 w-4" />}
              title="貨到付款"
              desc="送達時由買家現場付款"
              onClick={() => setPaymentStatus('cod')}
            />
          </div>
          {isEdit ? (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <PayCard
                active={paymentStatus === 'partial'}
                icon={<Coins className="h-4 w-4" />}
                title="部分付款"
                desc="已收部分款項"
                onClick={() => setPaymentStatus('partial')}
              />
              <PayCard
                active={paymentStatus === 'refunded'}
                icon={<X className="h-4 w-4" />}
                title="已退款"
                desc="款項已退回"
                onClick={() => setPaymentStatus('refunded')}
              />
            </div>
          ) : null}
        </FieldInline>

        {giftCostTotal > 0 ? (
          <p className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
            贈品成本 {formatCurrency(giftCostTotal)} 不計入買家合計，建立訂單時會記為公司開銷。
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="小計" value={formatCurrency(subtotal)} />
          <FieldInline label="折扣">
            <OrderDiscountField
              subtotal={subtotal}
              discount={discount}
              onDiscountChange={setDiscount}
            />
          </FieldInline>
          <FieldInline label="運費試算">
            <div className="space-y-1 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <p className="text-xs text-muted-foreground">
                {shippingMethodLabel({ shippingMethod, cvsBrand })}
              </p>
              <p className="font-mono tabular-nums">
                買家運費 {formatCurrency(shippingResolved.shippingFee)}
              </p>
              {shippingResolved.companyShippingCost > 0 ? (
                <p className="text-xs text-warning">
                  公司運費成本 {formatCurrency(shippingResolved.companyShippingCost)}（不計入合計）
                </p>
              ) : null}
            </div>
          </FieldInline>
          <Stat label="合計（買家應付）" value={formatCurrency(total)} highlight />
        </div>

        <FieldInline label="出貨與收件">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">
                  收件人姓名 <span className="text-destructive">*</span>
                </label>
                <Input
                  name="recipientName"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="例：王小明"
                  maxLength={80}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">
                  收件電話
                </label>
                <Input
                  name="recipientPhone"
                  type="tel"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="例：0912-345-678"
                  maxLength={40}
                  className="font-mono tabular-nums"
                />
              </div>
            </div>
            <div className="inline-flex flex-wrap gap-1 rounded-md border bg-background p-0.5">
              <button
                type="button"
                onClick={() => setShippingMethod('home')}
                className={`rounded px-3 py-1.5 text-xs ${
                  shippingMethod === 'home'
                    ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                宅配 · 黑貓（{SHIPPING_FEE_HOME_BLACK_CAT} 元）
              </button>
              <button
                type="button"
                onClick={() => setShippingMethod('convenience')}
                className={`rounded px-3 py-1.5 text-xs ${
                  shippingMethod === 'convenience'
                    ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                超商 · 7-11（{SHIPPING_FEE_CVS_711} 元）
              </button>
              <button
                type="button"
                onClick={() => setShippingMethod('delivery')}
                className={`rounded px-3 py-1.5 text-xs ${
                  shippingMethod === 'delivery'
                    ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                送貨
              </button>
            </div>

            {shippingMethod === 'convenience' ? (
              <div className="space-y-3 rounded-md border border-dashed bg-muted/20 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">
                      超商品牌 <span className="text-destructive">*</span>
                    </label>
                    <select
                      name="cvsBrand"
                      value={cvsBrand}
                      onChange={(e) => setCvsBrand(e.target.value)}
                      className="block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="711">7-ELEVEN</option>
                      <option value="familymart">全家 FamilyMart</option>
                      <option value="hilife">萊爾富 Hi-Life</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">
                      門市名稱 <span className="text-destructive">*</span>
                    </label>
                    <Input
                      name="cvsStoreName"
                      value={cvsStoreName}
                      onChange={(e) => setCvsStoreName(e.target.value)}
                      placeholder="例：復興門市"
                      maxLength={80}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground">
                    門市完整地址 或 711 取件資訊（選填）
                  </label>
                  <textarea
                    name="shippingAddress"
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="可貼門市完整地址或 711 簡訊／電子地圖上的取件說明"
                    className="block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">
                  {shippingMethod === 'delivery' ? '送貨地址' : '完整收件地址（宅配）'}
                </label>
                <textarea
                  name="shippingAddress"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder={
                    shippingMethod === 'delivery'
                      ? '例：新北市淡水區…（店家地址）'
                      : '例：台北市大安區復興南路一段 100 號 5 樓'
                  }
                  className="block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
          </div>
        </FieldInline>

        <FieldInline label="備註">
          <textarea
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            className="block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </FieldInline>
      </section>

      <div hidden={formStep !== 4} className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <div className="mr-auto flex items-center gap-2 text-sm">
          {isEdit && edit ? (
            <>
              <Badge variant="secondary">{edit.orderNumber}</Badge>
              <span className="text-muted-foreground">
                儲存後會同步更新品項、金額與關聯出貨單收件資訊。
              </span>
            </>
          ) : (
            <>
              <Badge variant="secondary">draft</Badge>
              <span className="text-muted-foreground">
                {orderType === 'customer'
                  ? '建立後會自動產生一張待出貨單，可於〈出貨隊列〉看到。'
                  : '寄賣店家訂單不會自動產生客戶出貨單。'}
              </span>
            </>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setFormStep(3)}>
          返回
        </Button>
        <SaveButton isEdit={isEdit} />
      </div>
    </form>
  );
}

type NewCustomerValue = {
  name: string;
  phone: string;
  email: string;
  address: string;
  lineDisplay: string;
  type: 'individual' | 'business';
  preferredShippingMethod: '' | 'home' | 'convenience';
  preferredCvsBrand: string;
  preferredCvsStoreId: string;
  preferredCvsStoreName: string;
};

function NewCustomerPanel({
  value,
  onChange,
  onSubmit,
  onCancel,
  pending,
}: {
  value: NewCustomerValue;
  onChange: (v: NewCustomerValue) => void;
  onSubmit: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-neutral-300 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex items-center gap-2 text-sm font-medium text-neutral-950 dark:text-white">
        <UserPlus className="h-3.5 w-3.5" />
        新增個人客戶
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] text-muted-foreground">
            姓名 <span className="text-destructive">*</span>
          </label>
          <Input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="王小明"
            maxLength={60}
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">電話</label>
          <Input
            type="tel"
            value={value.phone}
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
            placeholder="0912-345-678"
            maxLength={40}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Email</label>
          <Input
            type="email"
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
            placeholder="example@gmail.com"
            maxLength={120}
          />
        </div>
        {value.preferredShippingMethod === '' && (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] text-muted-foreground">地址（選填）</label>
            <Input
              value={value.address}
              onChange={(e) => onChange({ ...value, address: e.target.value })}
              placeholder="聯絡地址；未設定運輸方式時可留空"
              maxLength={200}
            />
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] text-muted-foreground">LINE 顯示名稱</label>
          <Input
            value={value.lineDisplay}
            onChange={(e) => onChange({ ...value, lineDisplay: e.target.value })}
            placeholder="若客戶來自 LINE，記下顯示名稱"
            maxLength={60}
          />
        </div>
      </div>

      {/* 預設運輸偏好 — 之後該客戶下單會自動帶入 */}
      <div className="space-y-2 rounded-md border border-neutral-200 bg-background/60 p-3 dark:border-neutral-800">
        <div className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">預設運輸方式（選填）</div>
        <div className="grid grid-cols-3 gap-2">
          {([
            ['none', '不設定'],
            ['home', '宅配'],
            ['convenience', '超商取貨'],
          ] as const).map(([method, label]) => {
            const selected = (value.preferredShippingMethod || 'none') === method;
            return (
              <button
                key={method}
                type="button"
                onClick={() => {
                  if (method === 'none') onChange({ ...value, preferredShippingMethod: '' });
                  if (method === 'home') onChange({ ...value, preferredShippingMethod: 'home' });
                  if (method === 'convenience') {
                    onChange({ ...value, preferredShippingMethod: 'convenience', address: '' });
                  }
                }}
                className={`min-h-9 rounded-lg border px-2 text-xs font-medium ${
                  selected
                    ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                    : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {value.preferredShippingMethod === 'home' && (
          <div className="space-y-2">
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">宅配地址</label>
              <Input
                value={value.address}
                onChange={(e) => onChange({ ...value, address: e.target.value })}
                placeholder="完整收件地址（會自動帶入訂單出貨地址）"
                maxLength={200}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              之後此客戶下單會自動帶入宅配地址。
            </p>
          </div>
        )}
        {value.preferredShippingMethod === 'convenience' && (
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">超商品牌</label>
              <select
                value={value.preferredCvsBrand}
                onChange={(e) =>
                  onChange({ ...value, preferredCvsBrand: e.target.value })
                }
                className="block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="711">7-ELEVEN</option>
                <option value="familymart">全家 FamilyMart</option>
                <option value="hilife">萊爾富 Hi-Life</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">門市名稱</label>
              <Input
                value={value.preferredCvsStoreName}
                onChange={(e) =>
                  onChange({ ...value, preferredCvsStoreName: e.target.value })
                }
                placeholder="復興門市"
                maxLength={80}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          取消
        </Button>
        <Button type="button" size="sm" onClick={onSubmit} disabled={pending}>
          {pending ? '建立中…' : '建立並選用'}
        </Button>
      </div>
    </div>
  );
}

function ToggleNewCustomerButton({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  if (open) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={onToggle}>
        <X className="mr-1 h-4 w-4" />
        取消新增
      </Button>
    );
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={onToggle}>
      <UserPlus className="mr-1 h-4 w-4" />
      新增客戶
    </Button>
  );
}

function TypeCard({
  active,
  icon,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
        active
          ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
          : 'border-neutral-200 bg-white text-neutral-950 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white dark:hover:bg-neutral-900'
      }`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-lg ${
          active
            ? 'bg-white/15 text-white dark:bg-black/10 dark:text-neutral-950'
            : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className={`mt-0.5 text-xs ${active ? 'text-white/70 dark:text-black/60' : 'text-muted-foreground'}`}>
          {desc}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0" />
    </button>
  );
}

function OrderProgress({ step }: { step: number }) {
  return (
    <div aria-label={`建立訂單，第 ${step} 步，共 4 步`} className="space-y-2">
      <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
        建立訂單 · {step}／4
      </div>
      <div className="grid grid-cols-4 gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((item) => (
          <span
            key={item}
            className={`h-1 rounded-full ${
              item <= step ? 'bg-neutral-950 dark:bg-white' : 'bg-neutral-200 dark:bg-neutral-800'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function WizardActions({
  onBack,
  onNext,
  nextDisabled = false,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      {onBack ? (
        <Button type="button" variant="outline" onClick={onBack}>
          返回
        </Button>
      ) : null}
      <Button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
      >
        繼續
      </Button>
    </div>
  );
}

function FeeTypeCard({
  active,
  icon,
  title,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  desc?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left transition ${
        active
          ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
          : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900'
      }`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${
          active
            ? 'bg-white/15 text-white dark:bg-black/10 dark:text-neutral-950'
            : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 text-xs font-medium">{title}</div>
    </button>
  );
}

function PayCard(props: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return <FeeTypeCard {...props} />;
}

function FieldInline({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${
        highlight
          ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
          : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900'
      }`}
    >
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 text-lg font-semibold tabular-nums ${
          highlight ? 'text-current' : ''
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function SaveButton({ isEdit }: { isEdit?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      disabled={pending}
      className="bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
    >
      <Save className="mr-1 h-4 w-4" />
      {pending ? (isEdit ? '儲存中…' : '建立中…') : isEdit ? '儲存修改' : '建立訂單'}
    </Button>
  );
}
