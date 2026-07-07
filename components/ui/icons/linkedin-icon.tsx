import * as React from "react";

// LinkedinIconProps extends standard SVG props so you can pass any SVG attribute you want
export interface LinkedinIconProps extends React.SVGProps<SVGSVGElement> {
  svgRef?: React.Ref<SVGSVGElement>;
}

// LinkedinIcon is a React component rendering LinkedIn's SVG icon using the new useRef composition pattern.
// The svgRef prop may be passed by the parent for direct access to the SVG element.
export function LinkedinIcon(
  { svgRef, ...props }: LinkedinIconProps
) {
  // If svgRef is not provided, fall back to internal ref (optional: can be omitted if not needed)
  const internalRef = React.useRef<SVGSVGElement>(null);
  const ref = svgRef ?? internalRef;

  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {/* Main LinkedIn logo shape; multiple pieces:
        - The main logo
        - The account profile circle
        - The left-side rectangle (the "in")
        - Outer border
        */}
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.03-1.84-3.03-1.85 0-2.13 1.45-2.13 2.94v5.66H9.36V9h3.42v1.56h.05c.48-.9 1.64-1.84 3.38-1.84 3.61 0 4.28 2.38 4.28 5.47v6.26zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56v11.45zM22 2H2v20h20V2z"/>
    </svg>
  );
}

// Set displayName explicitly for React DevTools readability and better debugging.
LinkedinIcon.displayName = "LinkedinIcon";