'use client';

import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { PET_SPECIES_OPTIONS } from '@/lib/customers/pet-fields';

export function LinePetFields() {
  const id = useId();
  const [species, setSpecies] = useState('');

  return (
    <details className="group rounded-[24px] border border-[#dce8e1] bg-white p-5 open:shadow-[0_10px_30px_rgba(23,71,51,0.06)]">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17613f] focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-base font-semibold text-[#173f2b]">毛孩資料（選填）</span>
          <span className="mt-1 block text-xs text-zinc-500">可稍後再補，不影響加入會員</span>
        </span>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eaf3ed] text-xl text-[#17613f] transition-transform group-open:rotate-45"
          aria-hidden="true"
        >
          ＋
        </span>
      </summary>

      <div className="mt-5 grid gap-4 border-t border-[#e4ece7] pt-5">
        <Field label="種類">
          <select
            name="petSpecies"
            value={species}
            onChange={(event) => setSpecies(event.target.value)}
            className="flex h-12 w-full rounded-2xl border border-[#b9cec1] bg-white px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17613f] focus-visible:ring-offset-2"
          >
            <option value="">不填寫</option>
            {PET_SPECIES_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="毛孩名字">
          <Input
            id={`${id}-petName`}
            name="petName"
            maxLength={80}
            placeholder="例：橘膩"
            className="h-12 rounded-2xl border-[#b9cec1] px-4 text-base focus-visible:ring-[#17613f]"
          />
        </Field>

        {species === 'other' ? (
          <Field label="其他種類" className="sm:col-span-2">
            <Input
              name="petSpeciesOther"
              maxLength={120}
              placeholder="例：刺蝟、貂"
              className="h-12 rounded-2xl border-[#b9cec1] px-4 text-base focus-visible:ring-[#17613f]"
            />
          </Field>
        ) : (
          <input type="hidden" name="petSpeciesOther" value="" />
        )}
      </div>
    </details>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-medium text-[#315b49]">{label}</label>
      {children}
    </div>
  );
}
