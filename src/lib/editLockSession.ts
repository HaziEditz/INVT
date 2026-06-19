const SESSION_KEY = 'bw_edit_lock_session';

/** Stable per-browser-tab id used to identify this dispatcher console session for edit locks. */
export function getEditLockSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `sess-${Date.now()}`;
  }
}
