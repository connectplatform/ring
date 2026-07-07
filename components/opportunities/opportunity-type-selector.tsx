// React 19 + Next.js 15: Server component wrapper
// Imports strictly typed user roles, the client wrapper, and locale type.
import { UserRolesArray } from '@/features/auth/user-role'
import { OpportunityTypeSelectorClient } from './opportunity-type-selector-client'
import type { Locale } from '@/i18n/shared'

// Props definition for the OpportunityTypeSelector component
interface OpportunityTypeSelectorProps {
  onClose?: () => void // Optional callback to trigger on close event
  userRole: UserRolesArray // The role of the current user; used for client component
  locale?: Locale // Optional locale prop for internationalization
  layout?: 'embedded' | 'overlay' // Layout determines visual embedding vs overlay
}

// TODO: Consider switching to React's Server Components "use client" pragma only inside the client file, 
// keeping this wrapper as a server component for props validation and session-based logic.
// TODO: If 'onClose' is needed by the server boundary, handle via React Actions or dispatched events (React 19 feature).

/**
 * The OpportunityTypeSelector is a server component acting as a passthrough to the client component.
 * It enforces typing, serves as a secure boundary, and passes only validated props.
 * 
 * @param props - OpportunityTypeSelectorProps containing userRole, locale, layout, and optionally onClose
 * @returns JSX.Element rendered on client via OpportunityTypeSelectorClient
 */
export function OpportunityTypeSelector(props: OpportunityTypeSelectorProps) {
  // Defensive cast: ensure only allowed userRole types are passed down.
  // TODO: If you expect more roles in the future, extract allowed roles as a constant or enum to remove hardcode.
  return (
    <OpportunityTypeSelectorClient 
      userRole={props.userRole as 'member' | 'subscriber'} // TODO: Ensure type safety/refactor if roles expand
      locale={props.locale}
      layout={props.layout}
      // MOCK CODE, TODO: Pass onClose down via Actions or other mechanisms if client needs closure from server actions.
    />
  )
}
