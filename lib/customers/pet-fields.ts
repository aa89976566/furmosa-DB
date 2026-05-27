/** 毛孩種類（存 DB 為英文 code，畫面顯示中文） */

export const PET_SPECIES_OPTIONS = [
  { code: 'dog', label: '犬' },
  { code: 'cat', label: '貓' },
  { code: 'rabbit', label: '兔' },
  { code: 'small_mammal', label: '天竺鼠／倉鼠等小型哺乳類' },
  { code: 'bird_reptile', label: '鳥／爬蟲等' },
  { code: 'fish', label: '水族' },
  { code: 'other', label: '其他（請手填）' },
] as const;

export type PetSpeciesCode = (typeof PET_SPECIES_OPTIONS)[number]['code'];

export const PET_SPECIES_CODES = PET_SPECIES_OPTIONS.map((o) => o.code) as readonly PetSpeciesCode[];

const LABEL_BY_CODE: Record<string, string> = Object.fromEntries(
  PET_SPECIES_OPTIONS.map((o) => [o.code, o.label]),
);

export function resolvePetSpeciesLabel(speciesCode: string | null, speciesOther: string | null): string | null {
  if (!speciesCode?.trim()) return speciesOther?.trim() || null;
  const base = LABEL_BY_CODE[speciesCode] ?? speciesCode;
  if (speciesCode === 'other' && speciesOther?.trim()) return `${base}（${speciesOther.trim()}）`;
  return base;
}

export type ParsedPetFields = {
  petSpecies: string | null;
  petSpeciesOther: string | null;
  petName: string | null;
  petAgeYears: number | null;
  petBirthday: Date | null;
};

export function parsePetFieldsFromFormData(formData: FormData): ParsedPetFields {
  const raw = String(formData.get('petSpecies') ?? '').trim().toLowerCase();
  const petSpecies =
    raw && PET_SPECIES_CODES.includes(raw as PetSpeciesCode) ? (raw as PetSpeciesCode) : null;

  const petSpeciesOther = String(formData.get('petSpeciesOther') ?? '').trim() || null;

  const petName = String(formData.get('petName') ?? '').trim() || null;

  const ageRaw = String(formData.get('petAgeYears') ?? '').trim();
  let petAgeYears: number | null = null;
  if (ageRaw !== '') {
    const n = parseInt(ageRaw, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 50) petAgeYears = n;
  }

  const dobRaw = String(formData.get('petBirthday') ?? '').trim();
  let petBirthday: Date | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dobRaw)) {
    const d = new Date(`${dobRaw}T12:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) petBirthday = d;
  }

  return {
    petSpecies,
    petSpeciesOther: petSpecies === 'other' ? petSpeciesOther : null,
    petName,
    petAgeYears,
    petBirthday,
  };
}

export function validatePetFieldsConsistency(p: ParsedPetFields): void {
  const hasPet =
    p.petName ||
    p.petSpecies ||
    (p.petSpeciesOther && p.petSpecies === 'other') ||
    p.petAgeYears !== null ||
    p.petBirthday !== null;

  if (!hasPet) return;

  if (!p.petSpecies) {
    throw new Error('已填毛孩資料時，請選擇種類');
  }
  if (!p.petName) {
    throw new Error('已填毛孩資料時，請填寫毛孩名字');
  }
  if (p.petSpecies === 'other' && !p.petSpeciesOther?.trim()) {
    throw new Error('請在「其他種類」簡短填寫');
  }
}
