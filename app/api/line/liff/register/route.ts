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

    const result = await registerOrUpdateLineCustomer({
      idToken,
      name: String(body.name ?? ''),
      phone: body.phone ?? null,
      petSpecies,
      petSpeciesOther: petSpecies === 'other' ? (body.petSpeciesOther?.trim() || null) : null,
      petName: (body.petName ?? '').trim() || null,
      petBreed: null,
      petAgeYears: null,
      petBirthday: null,
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
