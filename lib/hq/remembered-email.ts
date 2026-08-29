export const HQ_REMEMBERED_EMAIL_KEY = 'furmosa_hq_email';

export function readRememberedHqEmail(storage?: Pick<Storage, 'getItem'> | null) {
  if (!storage) return '';
  try {
    return storage.getItem(HQ_REMEMBERED_EMAIL_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function writeRememberedHqEmail(
  email: string,
  storage?: Pick<Storage, 'setItem'> | null,
) {
  if (!storage) return;
  const value = email.trim();
  if (!value) return;
  try {
    storage.setItem(HQ_REMEMBERED_EMAIL_KEY, value);
  } catch {
    /* ignore quota / private mode */
  }
}
