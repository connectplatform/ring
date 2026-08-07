'use client'

/** Shared PayPal mark — extracted from credit-add fs-modal (SSOT icon). */
export function PayPalIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path
        fill="#003087"
        d="M7.2 21.2H4.6c-.4 0-.6-.4-.5-.7L7.3 3.6c.1-.4.4-.7.8-.7h5.6c2.9 0 4.9 1.5 4.6 4.2-.4 3.4-2.9 5.3-6.1 5.3H9.5l-.9 5.1c-.1.4-.4.7-.8.7H7.2z"
      />
      <path
        fill="#009CDE"
        d="M9.7 12.4h1.8c2.7 0 4.7-1.5 5.1-4.2.3-2.1-.9-3.4-3.3-3.4H9.2c-.4 0-.7.3-.8.7L6.6 18.8c-.1.4.2.8.6.8h1.9l.6-7.2z"
      />
      <path
        fill="#012169"
        d="M9.1 8.9l-.9 5.4c-.1.4.2.7.6.7h1.5c2.4 0 4.3-1.2 4.7-3.9.3-1.8-.7-2.8-2.8-2.8H9.7c-.3 0-.5.2-.6.6z"
      />
    </svg>
  )
}
