import * as React from "react";

// Define prop types based on standard SVG props for extensibility.
export type GithubIconProps = React.SVGProps<SVGSVGElement>;

/**
 * GithubIcon renders the GitHub mark as an SVG.
 * 
 * Props are spread into the <svg> for flexibility.
 * 
 * Accessibility:
 * - "aria-hidden" set to true (hides from screen readers, for purely decorative use)
 * - "focusable" set to false (non-interactive)
 * 
 * TODO: If using React 19, consider using the new 'use' or 'memo' features where appropriate for further optimization.
 * TODO: If using Next.js 16, consider adding support for server actions if this icon is ever dynamically changed.
 * 
 * Logic analysis: This is currently a presentational, stateless component which can be used wherever a GitHub logo is required.
 */
export function GithubIcon(props: GithubIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"     // Sets the coordinate system for scaling.
      fill="currentColor"      // Inherits the color from parent for flexible theming.
      aria-hidden="true"       // Hides from assistive tech (decorative icon).
      focusable="false"        // Excludes from tab order (non-interactive).
      {...props}              // Allows consumers to override/add props (e.g., className, style, etc).
    >
      {/* The following <path> represents the GitHub mark. */}
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.868 8.166 6.839 9.489.5.093.682-.217.682-.482 0-.237-.009-.868-.014-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.153-1.11-1.461-1.11-1.461-.908-.62.069-.608.069-.608 1.003.07 1.532 1.03 1.532 1.03.892 1.529 2.341 1.088 2.91.833.091-.647.35-1.088.636-1.34-2.22-.253-4.555-1.111-4.555-4.943 0-1.091.39-1.984 1.029-2.682-.103-.253-.446-1.272.098-2.65 0 0 .84-.269 2.75 1.025A9.563 9.563 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.748-1.025 2.748-1.025.546 1.378.203 2.397.1 2.65.64.698 1.028 1.591 1.028 2.682 0 3.841-2.337 4.687-4.566 4.936.359.309.679.921.679 1.856 0 1.339-.013 2.422-.013 2.752 0 .268.18.579.688.481C19.135 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
    </svg>
  );
}

// Assign a display name for better React DevTools display.
GithubIcon.displayName = "GithubIcon";