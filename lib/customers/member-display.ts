export function maskLineUserId(lineUserId: string | null) {
  if (!lineUserId) return null;
  if (lineUserId.length <= 12) return lineUserId;
  return `${lineUserId.slice(0, 8)}…${lineUserId.slice(-4)}`;
}

export function resolvePetAgeYears(
  explicitAge: number | null,
  birthday: Date | null,
  now = new Date(),
) {
  if (explicitAge !== null) return explicitAge;
  if (!birthday || birthday > now) return null;

  let age = now.getUTCFullYear() - birthday.getUTCFullYear();
  const birthdayHasPassed =
    now.getUTCMonth() > birthday.getUTCMonth() ||
    (now.getUTCMonth() === birthday.getUTCMonth() &&
      now.getUTCDate() >= birthday.getUTCDate());

  if (!birthdayHasPassed) age -= 1;
  return Math.max(age, 0);
}
