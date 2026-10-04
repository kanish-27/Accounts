// Helpers for optimistic updates: the screen changes immediately and the
// server request runs in the background. New records get a temporary id
// until the server returns the real one.
export const tempId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const isTempId = (id) => typeof id === 'string' && id.startsWith('temp-');
