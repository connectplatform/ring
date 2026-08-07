'use client'

import { useEffect } from 'react'
import { registerRingMoodPlayer } from '@/components/common/custom-elements/mood-player-element'

/** Ensures <ring-mood-player> is defined on article / blog client trees. */
export function RegisterMoodPlayerElements() {
  useEffect(() => {
    registerRingMoodPlayer()
  }, [])
  return null
}
