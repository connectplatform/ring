/**
 * Subscribe to MediaQueryList changes with WebKit legacy fallback.
 * Older iOS Safari / WebKit only implement addListener/removeListener, not addEventListener —
 * calling addEventListener throws and can blank the React tree (WSOD).
 */
export function subscribeMediaQueryChange(
  mq: MediaQueryList,
  onChange: (matches: boolean) => void
): () => void {
  const emit = () => onChange(mq.matches)

  const legacyListener: Parameters<MediaQueryList['addListener']>[0] = () => {
    emit()
  }

  emit()

  if (typeof mq.addEventListener === 'function') {
    const handler = (e: MediaQueryListEvent) => onChange(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }

  mq.addListener(legacyListener)
  return () => mq.removeListener(legacyListener)
}
