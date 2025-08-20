import type { BackendAdapter } from './types'
import { FirebaseBackendAdapter } from './firebase-adapter'

export type BackendKind = 'firebase' | 'connect' | 'supabase' | 'prisma'

export function createBackendAdapter(kind: BackendKind = (process.env.RING_BACKEND as BackendKind) || 'firebase'): BackendAdapter {
  switch (kind) {
    case 'firebase':
      return new FirebaseBackendAdapter()
    case 'connect':
      throw new Error('ConnectPlatform adapter not configured')
    case 'supabase':
      throw new Error('Supabase adapter not configured')
    case 'prisma':
      throw new Error('Prisma adapter not configured')
    default:
      return new FirebaseBackendAdapter()
  }
}


