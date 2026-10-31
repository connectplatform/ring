'use client'

const HREF_KEY = 'ring-store-list-href'
const FROM_LIST_KEY = 'ring-store-list-pending-back'

export function rememberStoreListLocation(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(HREF_KEY, `${window.location.pathname}${window.location.search}`)
    sessionStorage.removeItem(FROM_LIST_KEY)
  } catch {
    /* private mode */
  }
}

export function markStoreListLeft(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(HREF_KEY, `${window.location.pathname}${window.location.search}`)
    sessionStorage.setItem(FROM_LIST_KEY, '1')
  } catch {
    /* private mode */
  }
}

export function readStoreListReturn(): { href: string | null; fromList: boolean } {
  if (typeof window === 'undefined') return { href: null, fromList: false }
  try {
    return {
      href: sessionStorage.getItem(HREF_KEY),
      fromList: sessionStorage.getItem(FROM_LIST_KEY) === '1',
    }
  } catch {
    return { href: null, fromList: false }
  }
}

export function clearStoreListPendingBack(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(FROM_LIST_KEY)
  } catch {
    /* private mode */
  }
}
