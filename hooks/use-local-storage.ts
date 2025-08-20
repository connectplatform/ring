import { useState, useEffect } from 'react'

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
        window.localStorage.setItem(key, JSON.stringify(storedValue))
        // Notify other hook instances in this tab
        const evt = new CustomEvent('ring:storage', { detail: { key, value: storedValue } })
        window.dispatchEvent(evt)
      } catch (error) {
        console.error('Error writing to localStorage:', error)
      }
    }
  }, [key, storedValue])

  // Listen for cross-tab and intra-tab updates
  useEffect(() => {
    const onCustom = (e: Event) => {
      const ce = e as CustomEvent
      if (ce.detail?.key === key) {
        try {
          const next = typeof ce.detail.value !== 'undefined' ? ce.detail.value : storedValue
          // Avoid infinite loops
          setStoredValue(next)
        } catch (_err) {}
      }
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        try {
          const next = e.newValue ? JSON.parse(e.newValue) : initialValue
          setStoredValue(next)
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
  }, [key])

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
    } catch (error) {
      console.error('Error setting value:', error)
    }
  }

  return [storedValue, setValue]
}