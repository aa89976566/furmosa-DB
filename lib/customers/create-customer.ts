import { prisma } from '@/lib/prisma';
import { nextCustomerId } from '@/lib/customers/customer-id';
import { validatePetFieldsConsistency, type ParsedPetFields } from '@/lib/customers/pet-fields';
import { storeBindingFromSlug, resolvePartnerStoreBySlug } from '@/lib/stores/partner-stores';

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
  signupStore?: string | null;
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

type NormalizedCustomerFields = {
  name: string;
  type: 'individual' | 'business';
  phone: string | null;
  email: string | null;
  address: string | null;
  lineUserId: string | null;
  lineDisplay: string | null;
  preferredShippingMethod: 'home' | 'convenience' | null;
  preferredCvsBrand: string | null;
  preferredCvsStoreId: string | null;
  preferredCvsStoreName: string | null;
  signupStore: string | null;
  storeId: string | null;
  storeName: string | null;
  pet: ParsedPetFields;
};

async function resolveStoreFields(signupStore: string | null) {
  if (!signupStore) return { storeId: null, storeName: null };
  const store = await resolvePartnerStoreBySlug(signupStore);
  if (store) return { storeId: store.slug, storeName: store.name };
  return storeBindingFromSlug(signupStore);
}

async function normalizeCustomerInput(input: CustomerCreateInput): Promise<NormalizedCustomerFields> {
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
  const preferredShippingMethod = sm === 'home' || sm === 'convenience' ? sm : null;

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
    preferredShippingMethod === 'convenience' ? null : (input.address ?? '').trim() || null;

  const pet: ParsedPetFields = {
    petSpecies: input.petSpecies ?? null,
    petSpeciesOther: input.petSpeciesOther ?? null,
    petName: input.petName ?? null,
    petAgeYears: input.petAgeYears ?? null,
    petBirthday: input.petBirthday ?? null,
  };
  validatePetFieldsConsistency(pet);

  const signupStore = (input.signupStore ?? '').trim() || null;
  const { storeId, storeName } = await resolveStoreFields(signupStore);

  return {
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
    signupStore,
    storeId,
    storeName,
    pet,
  };
}

export async function updateCustomerRecord(
  id: string,
  input: CustomerCreateInput,
): Promise<CreatedCustomerOption> {
  if (!id) throw new Error('缺少客戶 ID');
  const f = await normalizeCustomerInput(input);

  return prisma.customer.update({
    where: { id },
    data: {
      name: f.name,
      type: f.type,
      phone: f.phone,
      email: f.email,
      address: f.address,
      lineUserId: f.lineUserId,
      lineDisplay: f.lineDisplay,
      preferredShippingMethod: f.preferredShippingMethod,
      preferredCvsBrand: f.preferredCvsBrand,
      preferredCvsStoreId: f.preferredCvsStoreId,
      preferredCvsStoreName: f.preferredCvsStoreName,
      signupStore: f.signupStore,
      storeId: f.storeId,
      storeName: f.storeName,
      petSpecies: f.pet.petSpecies,
      petSpeciesOther: f.pet.petSpecies === 'other' ? f.pet.petSpeciesOther : null,
      petName: f.pet.petName,
      petAgeYears: f.pet.petAgeYears,
      petBirthday: f.pet.petBirthday,
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

export async function createCustomerRecord(
  input: CustomerCreateInput,
): Promise<CreatedCustomerOption> {
  const f = await normalizeCustomerInput(input);
  const {
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
    pet,
  } = f;

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
      signupStore: f.signupStore,
      storeId: f.storeId,
      storeName: f.storeName,
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
