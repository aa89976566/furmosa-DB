'use client';

import { useState } from 'react';

const PRESETS = ['7-11', '黑貓'] as const;
type Preset = (typeof PRESETS)[number];

// 物流選擇器：7-11 / 黑貓 / 其他（其他時跳出文字欄位手動填）
// 表單實際送出 input name="carrier"，值就是選的或填的字串
export function CarrierSelect({
  defaultValue,
  name = 'carrier',
  required = false,
  className,
}: {
  defaultValue?: string | null;
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

  const finalValue = mode === 'other' ? otherValue : (mode as string);

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

      {/* 真正送到伺服器的欄位 */}
      <input type="hidden" name={name} value={finalValue} />
    </div>
  );
}
