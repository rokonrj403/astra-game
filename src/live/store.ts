/** Tiny safe wrapper around localStorage: it can be missing, blocked or full, and the game must still work. */
export interface KeyValue {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function browserStore(): KeyValue | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readJSON<T>(store: KeyValue | null, key: string): T | null {
  try {
    const raw = store?.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeJSON(store: KeyValue | null, key: string, value: unknown): void {
  try {
    store?.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked: the game works without it */
  }
}
