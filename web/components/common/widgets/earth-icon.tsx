import React from 'react'

interface EarthIconProps {
  className?: string
  size?: number
}

export default function EarthIcon({ className = '', size = 64 }: EarthIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Earth outline */}
      <circle
        cx="32"
        cy="32"
        r="30"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />

      {/* Continents - simplified azimuthal equidistant projection */}
      {/* North America */}
      <path
        d="M20 25 L18 28 L22 30 L25 28 L23 25 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />

      {/* South America */}
      <path
        d="M25 35 L24 40 L27 42 L28 38 L26 35 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />

      {/* Europe */}
      <path
        d="M35 22 L38 22 L39 25 L36 26 L34 24 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />

      {/* Africa */}
      <path
        d="M37 28 L36 35 L40 37 L42 32 L40 28 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />

      {/* Asia */}
      <path
        d="M42 20 L48 18 L50 22 L46 25 L42 23 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />

      {/* Australia */}
      <path
        d="M48 38 L50 40 L52 39 L51 37 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />

      {/* Antarctica (simplified) */}
      <path
        d="M15 50 L49 50 L48 52 L16 52 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  )
}
