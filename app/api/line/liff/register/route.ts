import { NextResponse } from 'next/server';
import { registerOrUpdateLineCustomer } from '@/lib/line/liff-customer';
import type { PetSpeciesCode } from '@/lib/customers/pet-fields';
import { PET_SPECIES_CODES } from '@/lib/customers/pet-fields';

export const dynamic = 'force-dynamic';

type Body = {
  idToken?: string;
  name?: string;
  phone?: string | null;
  petSpecies?: string;
  petSpeciesOther?: string | null;
  petName?: string;
  petBreed?: string | null;
  petAgeYears?: number | string | null;
  petBirthday?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const idToken = body.idToken?.trim();
    if (!idToken) {
      return NextResponse.json({ error: '缺少登入資訊，請從 LINE 重新開啟' }, { status: 400 });
    }

    const rawSpecies = (body.petSpecies ?? '').trim().toLowerCase();
    const petSpecies =
      rawSpecies && PET_SPECIES_CODES.includes(rawSpecies as PetSpeciesCode)
        ? (rawSpecies as PetSpeciesCode)
        : null;

    let petAgeYears: number | null = null;
    if (body.petAgeYears !== null && body.petAgeYears !== undefined && body.petAgeYears !== '') {
      const n = parseInt(String(body.petAgeYears), 10);
      if (Number.isFinite(n) && n >= 0 && n <= 50) petAgeYears = n;
    }

    let petBirthday: Date | null = null;
    const dob = (body.petBirthday ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      const d = new Date(`${dob}T12:00:00.000Z`);
      if (!Number.isNaN(d.getTime())) petBirthday = d;
    }

    const result = await registerOrUpdateLineCustomer({
      idToken,
      name: String(body.name ?? ''),
      phone: body.phone ?? null,
      petSpecies,
      petSpeciesOther: petSpecies === 'other' ? (body.petSpeciesOther?.trim() || null) : null,
      petName: (body.petName ?? '').trim() || null,
      petBreed: (body.petBreed ?? '').trim().slice(0, 80) || null,
      petAgeYears,
      petBirthday,
    });

    return NextResponse.json({
      ok: true,
      isNew: result.isNew,
      message: result.isNew ? '註冊完成！之後直接傳 8 位序號就能存罐入帳。' : '資料已更新。',
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : '註冊失敗';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
