import { prisma } from '@/lib/prisma';
import { createCustomerRecord } from '@/lib/customers/create-customer';
import { validatePetFieldsConsistency, type ParsedPetFields } from '@/lib/customers/pet-fields';
import { revalidateJarExchangeHq } from '@/lib/jar-exchange/revalidate';
import { ensureJarExchangeService } from '@/lib/jar-exchange/services';
import { getJarExchangeStatsForCustomer } from '@/lib/jar-exchange/stats';
import { resolvePetSpeciesLabel } from '@/lib/customers/pet-fields';
import { runAfterReply } from '@/lib/line/defer';
import { verifyLineIdToken } from '@/lib/line/verify-id-token';
import { findCustomerByLineUserId } from '@/lib/line/bind-customer';

export type LineRegisterInput = {
  idToken: string;
  name: string;
  phone?: string | null;
} & ParsedPetFields;

export async function authenticateLineIdToken(idToken: string) {
  const payload = await verifyLineIdToken(idToken);
  return {
    lineUserId: payload.sub,
    lineDisplay: payload.name ?? null,
  };
}

export async function registerOrUpdateLineCustomer(input: LineRegisterInput) {
  const { lineUserId, lineDisplay } = await authenticateLineIdToken(input.idToken);

  const pet: ParsedPetFields = {
    petSpecies: input.petSpecies,
    petSpeciesOther: input.petSpeciesOther,
    petName: input.petName,
    petBreed: input.petBreed ?? null,
    petAgeYears: input.petAgeYears,
    petBirthday: input.petBirthday,
  };
  validatePetFieldsConsistency(pet);

  const name = input.name.trim();
  if (!name) throw new Error('請填寫您的稱呼');

  const phone = (input.phone ?? '').trim() || null;

  const existing = await findCustomerByLineUserId(lineUserId);

  if (existing) {
    await prisma.$transaction(async (tx) => {
      await tx.customer.updateMany({
        where: { lineUserId, id: { not: existing.id } },
        data: { lineUserId: null, lineDisplay: null },
      });
      await tx.customer.update({
        where: { id: existing.id },
        data: {
          name,
          phone,
          lineUserId,
          lineDisplay: lineDisplay ?? existing.lineDisplay,
          petSpecies: pet.petSpecies,
          petSpeciesOther: pet.petSpecies === 'other' ? pet.petSpeciesOther : null,
          petName: pet.petName,
          petBreed: pet.petBreed,
          petAgeYears: pet.petAgeYears,
          petBirthday: pet.petBirthday,
        },
      });
      await ensureJarExchangeService(tx, existing.id);
    });
    runAfterReply(Promise.resolve().then(() => revalidateJarExchangeHq()));

    return { customerId: existing.id, customerCode: existing.customerId, isNew: false };
  }

  const created = await createCustomerRecord({
    name,
    phone,
    lineUserId,
    lineDisplay,
    ...pet,
  });
  await ensureJarExchangeService(prisma, created.id);
  runAfterReply(Promise.resolve().then(() => revalidateJarExchangeHq()));

  return { customerId: created.id, customerCode: created.customerId, isNew: true };
}

export async function getLineMemberDashboard(idToken: string) {
  const { lineUserId } = await authenticateLineIdToken(idToken);
  const customer = await findCustomerByLineUserId(lineUserId);
  if (!customer) {
    return { registered: false as const };
  }

  const [full, stats] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customer.id },
      select: {
        name: true,
        customerId: true,
        petSpecies: true,
        petSpeciesOther: true,
        petName: true,
        petAgeYears: true,
        petBirthday: true,
        phone: true,
      },
    }),
    getJarExchangeStatsForCustomer(customer.id),
  ]);

  if (!full) return { registered: false as const };

  return {
    registered: true as const,
    name: full.name,
    customerCode: full.customerId,
    petName: full.petName,
    petSpeciesLabel: resolvePetSpeciesLabel(full.petSpecies, full.petSpeciesOther),
    petAgeYears: full.petAgeYears,
    petBirthday: full.petBirthday?.toISOString().slice(0, 10) ?? null,
    phone: full.phone,
    pointsBalance: stats.pointsBalance,
    jarsDeposited: stats.codesRedeemed,
    rewardsRedeemed: stats.rewardsRedeemed,
  };
}
