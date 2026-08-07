import { AsyncLocalStorage } from 'async_hooks' // Node.js module for managing async context per request
import { UserRolesArray } from '@/features/auth/user-role' // Importing the user roles array type

// Interface representing an authenticated actor in the MCP (My Control Panel) context
export interface McpActor {
  id: string        // Unique user identifier
  email: string     // User email address
  name: string      // Full name of the user
  role: UserRolesArray // User roles as defined in application
}

// Create an AsyncLocalStorage instance for storing the current McpActor context during async operations
const mcpActorStorage = new AsyncLocalStorage<McpActor>()

/**
 * Runs the provided async function within a context that is associated with the given McpActor.
 * This ensures that throughout the async call chain, getMcpActor() will return the correct actor.
 * 
 * @param actor The actor to bind in the current context
 * @param fn The async function to execute with this context
 * @returns The result of the async function
 */
export function runWithMcpActor<T>(actor: McpActor, fn: () => Promise<T>): Promise<T> {
  // TODO: If migrating to Next.js 13/14/15+ React Server Components/React19, consider using the new Context API with server actions
  // and React's use() for context propagation in concurrent environments where possible.
  // See: https://react.dev/reference/react/use
  return mcpActorStorage.run(actor, fn)
}

/**
 * Retrieves the current McpActor from the async local storage context.
 * Returns undefined if called outside a runWithMcpActor context.
 * 
 * @returns The current McpActor or undefined if not set
 */
export function getMcpActor(): McpActor | undefined {
  return mcpActorStorage.getStore()
}
