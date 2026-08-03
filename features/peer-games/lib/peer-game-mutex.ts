'use client'

/**
 * Call ↔ game mutex (client). Server still enforces participant ACL.
 *
 * Cross-tab (browser_cross_tab_mutex_specialist):
 * - BroadcastChannel fan-out for mirror state
 * - navigator.locks (ifAvailable) to claim exclusive hold
 * - Public API stable: setPeerCallBusy / setPeerGameBusy / hooks
 *
 * UPGRADE: Tunnel presence for cross-device busy (not just same-origin tabs).
 */

import { useSyncExternalStore } from 'react'

const CHANNEL = 'ring-peer-mutex-v1'
const LOCK_CALL = 'ring-peer-call-busy'
const LOCK_GAME = 'ring-peer-game-busy'
const HEARTBEAT_MS = 2000
const STALE_MS = 6000

type Resource = 'call' | 'game'

type MutexMsg =
  | { type: 'state'; tabId: string; ts: number; callBusy: boolean; gameBusy: boolean }
  | { type: 'query'; tabId: string; ts: number }

let gameBusy = false
let callBusy = false
const listeners = new Set<() => void>()

const tabId =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tab-${Math.random().toString(36).slice(2)}`

let bc: BroadcastChannel | null = null
let callLockRelease: (() => void) | null = null
let gameLockRelease: (() => void) | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let lastRemoteTs = 0

function emit() {
  for (const l of listeners) l()
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  return () => listeners.delete(onStoreChange)
}

function broadcastState() {
  if (!bc) return
  const msg: MutexMsg = {
    type: 'state',
    tabId,
    ts: Date.now(),
    callBusy,
    gameBusy,
  }
  try {
    bc.postMessage(msg)
  } catch {
    /* channel closed */
  }
}

function applyRemote(msg: MutexMsg) {
  if (msg.type !== 'state' || msg.tabId === tabId) return
  if (msg.ts < lastRemoteTs) return
  lastRemoteTs = msg.ts
  let changed = false
  // Mirror remote busy when we do not hold the local lock for that resource.
  if (!callLockRelease && callBusy !== msg.callBusy) {
    callBusy = msg.callBusy
    changed = true
  }
  if (!gameLockRelease && gameBusy !== msg.gameBusy) {
    gameBusy = msg.gameBusy
    changed = true
  }
  if (changed) emit()
}

async function tryAcquireLock(name: string): Promise<(() => void) | null> {
  if (typeof navigator === 'undefined' || !navigator.locks?.request) {
    return () => {}
  }
  return new Promise((resolve) => {
    let released = false
    let releaseFn: (() => void) | null = null
    const hold = new Promise<void>((res) => {
      releaseFn = () => {
        if (released) return
        released = true
        res()
      }
    })
    void navigator.locks
      .request(name, { ifAvailable: true }, async (lock) => {
        if (!lock) {
          resolve(null)
          return
        }
        resolve(releaseFn)
        await hold
      })
      .catch(() => resolve(null))
  })
}

function ensureChannel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return
  if (bc) return
  try {
    bc = new BroadcastChannel(CHANNEL)
    bc.onmessage = (ev: MessageEvent<MutexMsg>) => {
      const msg = ev.data
      if (!msg || typeof msg !== 'object') return
      if (msg.type === 'query' && msg.tabId !== tabId) {
        if (callBusy || gameBusy || callLockRelease || gameLockRelease) {
          broadcastState()
        }
        return
      }
      applyRemote(msg)
    }
    const query: MutexMsg = { type: 'query', tabId, ts: Date.now() }
    bc.postMessage(query)
  } catch {
    bc = null
  }

  if (!heartbeatTimer) {
    heartbeatTimer = setInterval(() => {
      if (callBusy || gameBusy) broadcastState()
      // Clear mirrored busy if remote went silent (holder crashed).
      if (!callLockRelease && callBusy && Date.now() - lastRemoteTs > STALE_MS) {
        callBusy = false
        emit()
      }
      if (!gameLockRelease && gameBusy && Date.now() - lastRemoteTs > STALE_MS) {
        gameBusy = false
        emit()
      }
    }, HEARTBEAT_MS)
  }

  const onPageHide = () => {
    void setPeerCallBusy(false)
    void setPeerGameBusy(false)
  }
  window.addEventListener('pagehide', onPageHide)
}

ensureChannel()

async function setBusy(resource: Resource, next: boolean): Promise<boolean> {
  ensureChannel()
  const get = () => (resource === 'call' ? callBusy : gameBusy)
  const setLocal = (v: boolean) => {
    if (resource === 'call') callBusy = v
    else gameBusy = v
  }
  const getRelease = () => (resource === 'call' ? callLockRelease : gameLockRelease)
  const setRelease = (fn: (() => void) | null) => {
    if (resource === 'call') callLockRelease = fn
    else gameLockRelease = fn
  }
  const lockName = resource === 'call' ? LOCK_CALL : LOCK_GAME

  if (next === get()) {
    broadcastState()
    return true
  }

  if (!next) {
    const release = getRelease()
    if (release) {
      release()
      setRelease(null)
    }
    setLocal(false)
    emit()
    broadcastState()
    return true
  }

  const release = await tryAcquireLock(lockName)
  if (release === null) {
    // Another tab holds the lock — mirror busy and reject acquire.
    setLocal(true)
    emit()
    broadcastState()
    return false
  }
  setRelease(release)
  setLocal(true)
  emit()
  broadcastState()
  return true
}

/** Returns false when another tab already holds the call lock. */
export async function setPeerCallBusy(next: boolean): Promise<boolean> {
  return setBusy('call', next)
}

/** Returns false when another tab already holds the game lock. */
export async function setPeerGameBusy(next: boolean): Promise<boolean> {
  return setBusy('game', next)
}

export function getPeerGameBusy() {
  return gameBusy
}

export function getPeerCallBusy() {
  return callBusy
}

export function usePeerGameBusy() {
  return useSyncExternalStore(subscribe, getPeerGameBusy, () => false)
}

export function usePeerCallBusy() {
  return useSyncExternalStore(subscribe, getPeerCallBusy, () => false)
}
