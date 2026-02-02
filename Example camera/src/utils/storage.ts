export const readLocalJson = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback
  try {
    const value = window.localStorage.getItem(key)
    if (!value) return fallback
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export const writeLocalJson = <T>(key: string, value: T) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

export const clearLocalKey = (key: string) => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(key)
}

