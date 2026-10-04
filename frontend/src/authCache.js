// Remembers a SHA-256 hash of the last password the server accepted, so the
// login button can unlock instantly while the (possibly sleeping) backend
// re-verifies in the background.
const KEY = 'admin_pw_hash';

const hashPassword = async (password) => {
  if (!window.crypto?.subtle) return null;
  const bytes = new TextEncoder().encode(password);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
};

export const matchesCachedPassword = async (password) => {
  try {
    const cached = localStorage.getItem(KEY);
    if (!cached) return false;
    return cached === await hashPassword(password);
  } catch {
    return false;
  }
};

export const cachePassword = async (password) => {
  try {
    const hash = await hashPassword(password);
    if (hash) localStorage.setItem(KEY, hash);
  } catch {
    // Storage unavailable: next login just waits for the server
  }
};

export const clearCachedPassword = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
};
