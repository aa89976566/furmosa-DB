'use client';

import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { PET_SPECIES_OPTIONS } from '@/lib/customers/pet-fields';

export function LinePetFields() {
  const id = useId();
  const [species, setSpecies] = useState('');

  return (
    <div className="space-y-4 rounded-xl border bg-muted/15 p-4">
      <div>
        <p className="text-sm font-medium text-foreground">毛孩資料（選填）</p>
        <p className="mt-0.5 text-xs text-muted-foreground">名字與種類都可分開填；知道多少先填多少。</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="種類">
          <select
            name="petSpecies"
            value={species}
            onChange={(event) => setSpecies(event.target.value)}
            className="flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
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
          <Input id={`${id}-petName`} name="petName" maxLength={80} placeholder="例：橘膩" />
        </Field>

        {species === 'other' ? (
          <Field label="其他種類" className="sm:col-span-2">
            <Input name="petSpeciesOther" maxLength={120} placeholder="例：刺蝟、貂" />
          </Field>
        ) : (
          <input type="hidden" name="petSpeciesOther" value="" />
        )}
      </div>
    </div>
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
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
