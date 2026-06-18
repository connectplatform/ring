import { useState, useEffect } from 'react'

function storageSerialized<T>(value: T): string {
  return JSON.stringify(value)
}

function storageEquals<T>(a: T, b: T): boolean {
  return storageSerialized(a) === storageSerialized(b)
}

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }

    try {
      const item = window.localStorage.getItem(key)
      const parsed = item ? JSON.parse(item) : initialValue
      return parsed ?? initialValue
    } catch (error) {
      console.error('Error reading from localStorage:', error)
      return initialValue
    }
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const serialized = storageSerialized(storedValue)
        const existing = window.localStorage.getItem(key)
        if (existing === serialized) {
          return
        }
        window.localStorage.setItem(key, serialized)
        const evt = new CustomEvent('ring:storage', { detail: { key, value: storedValue } })
        window.dispatchEvent(evt)
      } catch (error) {
        console.error('Error writing to localStorage:', error)
      }
    }
  }, [key, storedValue])

  useEffect(() => {
    const onCustom = (e: Event) => {
      const ce = e as CustomEvent
      if (ce.detail?.key === key) {
        try {
          const next = typeof ce.detail.value !== 'undefined' ? ce.detail.value : storedValue
          setStoredValue((current) => (storageEquals(current, next) ? current : next))
        } catch (_err) {}
      }
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        try {
          const next = e.newValue ? JSON.parse(e.newValue) : initialValue
          setStoredValue((current) => (storageEquals(current, next) ? current : next))
        } catch (_err) {}
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('ring:storage', onCustom as EventListener)
      window.addEventListener('storage', onStorage)
      return () => {
        window.removeEventListener('ring:storage', onCustom as EventListener)
        window.removeEventListener('storage', onStorage)
      }
    }
  }, [key, initialValue])

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      if (storageEquals(storedValue, valueToStore)) {
        return
      }
      setStoredValue(valueToStore)
    } catch (error) {
      console.error('Error setting value:', error)
    }
  }

  return [storedValue, setValue]
}
