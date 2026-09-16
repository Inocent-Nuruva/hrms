import * as SecureStore from './secure-store';

const REMEMBERED_EMAILS_KEY = 'hrms.rememberedEmails';
const MAX_REMEMBERED_EMAILS = 8;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseEmails(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((entry): entry is string => typeof entry === 'string')
      .map(normalizeEmail)
      .filter(Boolean)
      .filter((entry, index, entries) => entries.indexOf(entry) === index)
      .slice(0, MAX_REMEMBERED_EMAILS);
  } catch {
    return [];
  }
}

export async function getRememberedEmails() {
  return parseEmails(await SecureStore.getItemAsync(REMEMBERED_EMAILS_KEY));
}

export async function rememberSuccessfulEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return getRememberedEmails();

  const existing = await getRememberedEmails();
  const updated = [normalizedEmail, ...existing.filter((entry) => entry !== normalizedEmail)].slice(
    0,
    MAX_REMEMBERED_EMAILS,
  );

  await SecureStore.setItemAsync(REMEMBERED_EMAILS_KEY, JSON.stringify(updated));
  return updated;
}
