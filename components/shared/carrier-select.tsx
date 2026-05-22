'use client';

import { useEffect, useState } from 'react';
import { CARRIER_711 } from '@/lib/carrier-cvs';

const PRESETS = [CARRIER_711, '黑貓'] as const;
type Preset = (typeof PRESETS)[number];

// 物流選擇器：7-11 / 黑貓 / 其他（其他時跳出文字欄位手動填）
// 選 7-11 時顯示收件人姓名、電話（必填），表單送出 name="carrier"
export function CarrierSelect({
  defaultValue,
  defaultPickupStore,
  defaultPickupName,
  defaultPickupPhone,
  name = 'carrier',
  required = false,
  className,
}: {
  defaultValue?: string | null;
  defaultPickupStore?: string | null;
  defaultPickupName?: string | null;
  defaultPickupPhone?: string | null;
  name?: string;
  required?: boolean;
  className?: string;
}) {
  const initial = (defaultValue ?? '').trim();
  const initialMode: Preset | 'other' | '' = (PRESETS as readonly string[]).includes(initial)
    ? (initial as Preset)
    : initial
      ? 'other'
      : '';
  const [mode, setMode] = useState<Preset | 'other' | ''>(initialMode);
  const [otherValue, setOtherValue] = useState(initialMode === 'other' ? initial : '');
  const [pickupStore, setPickupStore] = useState(defaultPickupStore ?? '');
  const [pickupName, setPickupName] = useState(defaultPickupName ?? '');
  const [pickupPhone, setPickupPhone] = useState(defaultPickupPhone ?? '');

  useEffect(() => {
    const nextCarrier = (defaultValue ?? '').trim();
    const nextMode: Preset | 'other' | '' = (PRESETS as readonly string[]).includes(nextCarrier)
      ? (nextCarrier as Preset)
      : nextCarrier
        ? 'other'
        : '';
    setMode(nextMode);
    if (nextMode === 'other') setOtherValue(nextCarrier);
    setPickupStore(defaultPickupStore ?? '');
    setPickupName(defaultPickupName ?? '');
    setPickupPhone(defaultPickupPhone ?? '');
  }, [defaultValue, defaultPickupStore, defaultPickupName, defaultPickupPhone]);

  const finalValue = mode === 'other' ? otherValue : (mode as string);
  const show711Fields = mode === CARRIER_711;

  return (
    <div className={className}>
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as Preset | 'other' | '')}
        className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">請選擇物流</option>
        {PRESETS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
        <option value="other">其他...</option>
      </select>

      {mode === 'other' && (
        <input
          type="text"
          value={otherValue}
          onChange={(e) => setOtherValue(e.target.value)}
          placeholder="請填寫物流名稱（例如：自送、順豐）"
          required={required}
          className="mt-2 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      )}

      {show711Fields && (
        <div className="mt-3 space-y-3 rounded-md border border-dashed border-info/40 bg-info/5 p-3">
          <p className="text-xs text-muted-foreground">
            請填寫 <span className="font-medium text-foreground">7-11 取件門市</span> 與取件人聯絡方式
          </p>
          <div className="space-y-1">
            <label htmlFor={`${name}-pickupStore`} className="text-xs font-medium">
              門市 <span className="text-destructive">*</span>
            </label>
            <input
              id={`${name}-pickupStore`}
              name="pickupStore"
              type="text"
              value={pickupStore}
              onChange={(e) => setPickupStore(e.target.value)}
              placeholder="例：淡水復興門市"
              maxLength={80}
              required
              className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor={`${name}-pickupName`} className="text-xs font-medium">
                姓名 <span className="text-destructive">*</span>
              </label>
              <input
                id={`${name}-pickupName`}
                name="pickupName"
                type="text"
                value={pickupName}
                onChange={(e) => setPickupName(e.target.value)}
                placeholder="例：王小明"
                maxLength={80}
                required
                className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${name}-pickupPhone`} className="text-xs font-medium">
                電話 <span className="text-destructive">*</span>
              </label>
              <input
                id={`${name}-pickupPhone`}
                name="pickupPhone"
                type="tel"
                value={pickupPhone}
                onChange={(e) => setPickupPhone(e.target.value)}
                placeholder="例：0912345678"
                maxLength={20}
                required
                className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>
      )}

      <input type="hidden" name={name} value={finalValue} />
    </div>
  );
}
