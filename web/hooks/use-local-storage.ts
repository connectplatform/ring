import { useState, useEffect, useCallback } from 'react'

function storageSerialized<T>(value: T): string {
  return JSON.stringify(value)
}

function storageEquals<T>(a: T, b: T): boolean {
  return storageSerialized(a) === storageSerialized(b)
}

/**
 * Hydration-safe localStorage state.
 *
 * Always initializes with `initialValue` on both server and the first client
 * render, then reads from localStorage in an effect. Writes are deferred until
 * after that hydration so we never clobber stored data with the SSR default.
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue)
  const [hydrated, setHydrated] = useState(false)

  // Read from localStorage after mount (SSR + first client paint stay identical).
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key)
      if (item != null) {
        const parsed = JSON.parse(item) as T
        setStoredValue(parsed ?? initialValue)
      }
    } catch (error) {
      console.error('Error reading from localStorage:', error)
    }
    setHydrated(true)
    // initialValue is the SSR fallback only — intentionally omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Persist only after hydration so we never overwrite LS with initialValue.
  useEffect(() => {
    if (!hydrated) return
    try {
      const serialized = storageSerialized(storedValue)
      const existing = window.localStorage.getItem(key)
      if (existing === serialized) return
      window.localStorage.setItem(key, serialized)
      window.dispatchEvent(new CustomEvent('ring:storage', { detail: { key, value: storedValue } }))
    } catch (error) {
      console.error('Error writing to localStorage:', error)
    }
  }, [key, storedValue, hydrated])

  useEffect(() => {
    const onCustom = (e: Event) => {
      const ce = e as CustomEvent
      if (ce.detail?.key !== key) return
      try {
        const next = typeof ce.detail.value !== 'undefined' ? ce.detail.value : storedValue
        setStoredValue((current) => (storageEquals(current, next) ? current : next))
      } catch {
        /* ignore */
      }
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return
      try {
        const next = e.newValue ? JSON.parse(e.newValue) : initialValue
        setStoredValue((current) => (storageEquals(current, next) ? current : next))
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('ring:storage', onCustom as EventListener)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('ring:storage', onCustom as EventListener)
      window.removeEventListener('storage', onStorage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, initialValue])

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        setStoredValue((current) => {
          const valueToStore = value instanceof Function ? value(current) : value
          return storageEquals(current, valueToStore) ? current : valueToStore
        })
      } catch (error) {
        console.error('Error setting value:', error)
      }
    },
    [],
  )

  return [storedValue, setValue]
}
