export const POS_REMEMBERED_USERNAME_KEY = 'furmosa_pos_username';

export function readRememberedPosUsername(storage?: Pick<Storage, 'getItem'> | null) {
  if (!storage) return '';
  try {
    return storage.getItem(POS_REMEMBERED_USERNAME_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function writeRememberedPosUsername(
  username: string,
  storage?: Pick<Storage, 'setItem'> | null,
) {
  if (!storage) return;
  const value = username.trim();
  if (!value) return;
  try {
    storage.setItem(POS_REMEMBERED_USERNAME_KEY, value);
  } catch {
    /* ignore quota / private mode */
  }
}
