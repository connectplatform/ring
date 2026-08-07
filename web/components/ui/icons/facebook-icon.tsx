import * as React from 'react';

// Define types for the FacebookIcon component props.
// - Inherit all SVG properties, and add optional title and titleId for accessibility.
export type FacebookIconProps = React.SVGProps<SVGSVGElement> & {
  title?: string;    // Accessible title for the icon, screen readers, etc.
  titleId?: string;  // Optional ID, for aria-labelledby linking the title.
};

// ForwardRef to allow parent components to reference the SVG element directly.
export const FacebookIcon = React.forwardRef<SVGSVGElement, FacebookIconProps>(
  (
    {
      title = "Facebook icon", // Default accessible title.
      titleId,                // Optional ID for title.
      ...props                // Spread all other SVG props.
    },
    ref
  ) => (
    <svg
      ref={ref}
      {...props}                // Spread all other SVG props.
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden={title ? undefined : "true"}
      aria-labelledby={title ? titleId : undefined}
      focusable="false"
    >
      {title ? <title id={titleId}>{title}</title> : null}
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z"/>
    </svg>
  )
);

// Specify a display name for React DevTools.
FacebookIcon.displayName = "FacebookIcon";