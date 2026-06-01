'use client';

import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { PET_SPECIES_OPTIONS } from '@/lib/customers/pet-fields';

export type PetFieldDefaults = {
  petSpecies?: string | null;
  petSpeciesOther?: string | null;
  petName?: string | null;
  petAgeYears?: number | null;
  petBirthday?: string | null;
};

type Props = {
  /** 用於換罐快速表單等僅顯示必填星號在名字 */
  requirePetWhenAny?: boolean;
  defaults?: PetFieldDefaults;
};

export function PetProfileFieldsBlock({
  requirePetWhenAny: _requirePetWhenAny,
  defaults,
}: Props) {
  const id = useId();
  const [species, setSpecies] = useState(defaults?.petSpecies ?? '');

  return (
    <div className="space-y-4 rounded-xl border bg-muted/15 p-4">
      <div>
        <p className="text-sm font-medium text-foreground">毛孩資料（選填）</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          有填寫時，種類與名字請一併填寫；生日可留空。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="種類">
          <select
            name="petSpecies"
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
            className="flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
          >
            <option value="">不填寫</option>
            {PET_SPECIES_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
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
            defaultValue={defaults?.petName ?? ''}
          />
        </Field>
        <Field label="約幾歲（足歲）">
          <Input
            name="petAgeYears"
            type="number"
            inputMode="numeric"
            min={0}
            max={50}
            placeholder="選填，0–50"
            defaultValue={defaults?.petAgeYears ?? ''}
          />
        </Field>
        <Field label="生日（選填）">
          <Input name="petBirthday" type="date" defaultValue={defaults?.petBirthday ?? ''} />
        </Field>
        {species === 'other' ? (
          <Field label="其他種類" className="sm:col-span-2">
            <Input
              name="petSpeciesOther"
              maxLength={120}
              placeholder="例：刺蝟、貂"
              defaultValue={defaults?.petSpeciesOther ?? ''}
            />
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
