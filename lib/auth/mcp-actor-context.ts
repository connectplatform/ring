import { AsyncLocalStorage } from 'async_hooks'
import { UserRole } from '@/features/auth/types'

export interface McpActor {
  id: string
  email: string
  name: string
  role: UserRole
}

const mcpActorStorage = new AsyncLocalStorage<McpActor>()

export function runWithMcpActor<T>(actor: McpActor, fn: () => Promise<T>): Promise<T> {
  return mcpActorStorage.run(actor, fn)
}

export function getMcpActor(): McpActor | undefined {
  return mcpActorStorage.getStore()
}
