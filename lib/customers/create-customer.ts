import { prisma } from '@/lib/prisma';
import { nextCustomerId } from '@/lib/customers/customer-id';
import { validatePetFieldsConsistency, type ParsedPetFields } from '@/lib/customers/pet-fields';

export type CustomerCreateInput = {
  name: string;
  type?: 'individual' | 'business';
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  lineUserId?: string | null;
  lineDisplay?: string | null;
  preferredShippingMethod?: 'home' | 'convenience' | null;
  preferredCvsBrand?: string | null;
  preferredCvsStoreId?: string | null;
  preferredCvsStoreName?: string | null;
} & Partial<ParsedPetFields>;

export type CreatedCustomerOption = {
  id: string;
  customerId: string;
  name: string;
  phone: string | null;
  address: string | null;
  preferredShippingMethod: string | null;
  preferredCvsBrand: string | null;
  preferredCvsStoreId: string | null;
  preferredCvsStoreName: string | null;
};

export async function createCustomerRecord(
  input: CustomerCreateInput,
): Promise<CreatedCustomerOption> {
  const name = (input.name ?? '').trim();
  if (!name) throw new Error('客戶姓名為必填');

  const type = input.type === 'business' ? 'business' : 'individual';
  const phone = (input.phone ?? '').trim() || null;
  const email = (input.email ?? '').trim() || null;
  const lineUserId = (input.lineUserId ?? '').trim() || null;
  const lineDisplay = (input.lineDisplay ?? '').trim() || null;

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Email 格式錯誤');
  }

  const sm = input.preferredShippingMethod;
  const preferredShippingMethod =
    sm === 'home' || sm === 'convenience' ? sm : null;

  let preferredCvsBrand: string | null = null;
  let preferredCvsStoreId: string | null = null;
  let preferredCvsStoreName: string | null = null;

  if (preferredShippingMethod === 'convenience') {
    const VALID_BRANDS = ['711', 'familymart', 'hilife'];
    const brand = (input.preferredCvsBrand ?? '').trim();
    if (brand && !VALID_BRANDS.includes(brand)) {
      throw new Error('超商品牌錯誤');
    }
    preferredCvsBrand = brand || null;
    preferredCvsStoreId = (input.preferredCvsStoreId ?? '').trim() || null;
    preferredCvsStoreName = (input.preferredCvsStoreName ?? '').trim() || null;
  }

  const address =
    preferredShippingMethod === 'convenience'
      ? null
      : (input.address ?? '').trim() || null;

  const pet: ParsedPetFields = {
    petSpecies: input.petSpecies ?? null,
    petSpeciesOther: input.petSpeciesOther ?? null,
    petName: input.petName ?? null,
    petAgeYears: input.petAgeYears ?? null,
    petBirthday: input.petBirthday ?? null,
  };
  validatePetFieldsConsistency(pet);

  const customerId = await nextCustomerId();
  return prisma.customer.create({
    data: {
      customerId,
      name,
      type,
      phone,
      email,
      address,
      lineUserId,
      lineDisplay,
      preferredShippingMethod,
      preferredCvsBrand,
      preferredCvsStoreId,
      preferredCvsStoreName,
      petSpecies: pet.petSpecies,
      petSpeciesOther: pet.petSpecies === 'other' ? pet.petSpeciesOther : null,
      petName: pet.petName,
      petAgeYears: pet.petAgeYears,
      petBirthday: pet.petBirthday,
    },
    select: {
      id: true,
      customerId: true,
      name: true,
      phone: true,
      address: true,
      preferredShippingMethod: true,
      preferredCvsBrand: true,
      preferredCvsStoreId: true,
      preferredCvsStoreName: true,
    },
  });
}
