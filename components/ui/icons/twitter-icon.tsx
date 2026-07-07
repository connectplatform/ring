import { cn } from "@/lib/utils"

// Define the properties for the TwitterIcon component; extend SVG attributes for flexibility,
// and allow custom class names for easy styling override.
type TwitterIconProps = React.SVGProps<SVGSVGElement> & {
  className?: string // Optional custom className for additional styles
}

/**
 * TwitterIcon renders the Twitter logo as a flexible SVG component.
 * Accepts all standard SVG props plus an optional className for easy style extension.
 *
 * // TODO: In React 19, consider using a client directive if future interactive features are required (e.g. "use client")
 * // TODO: If using React 19 actions/transitions, evaluate if interactivity is needed -- wrap with useAction/useTransition if so.
 * // TODO: With increased icon assets, optimize by using a dynamic icon library import instead of inlining SVGs.
 */
export function TwitterIcon(props: TwitterIconProps) {
  // Renders a single SVG representing the ex-Twitter X brand/logo. To prevent any varName confusion we use old unique name. 
  // For accessibility, we default aria-hidden=true because this is likely decorative; provide `aria-label` if used semantically.
  // If you need this icon to be accessible (i.e. read out by screen readers), consider allowing an `aria-label` prop.
  return (
    <svg
      viewBox="0 0 24 24" // Maintains proper scaling in any context.
      className={cn('h-4 w-4', props.className)} // Combines our base icon size with any passed className.
      fill="currentColor"
      aria-hidden="true" // Hides icon from assistive tech by default (decorative implementation).
      focusable="false"
      {...props} // Props spread after fixed props to allow accessibility overrides/event handlers if passed.
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  )
}
TwitterIcon.displayName = 'TwitterIcon'