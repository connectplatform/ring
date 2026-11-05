'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type CallRoundButtonProps = {
  tone: 'end' | 'answer' | 'neutral'
  label: string
  children: ReactNode
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'disabled'>

const TONE_BACKGROUND = {
  end: '#dc2626',
  answer: '#059669',
  neutral: '#3f3f46',
} as const

/**
 * Call controls sit outside the shared Button variants.
 * Those variants add height and horizontal padding that beat rounded-full,
 * so the hit target becomes a pill and the glyph collapses.
 */
export function CallRoundButton({
  tone,
  label,
  children,
  disabled,
  onClick,
}: CallRoundButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 56,
        height: 56,
        minWidth: 56,
        minHeight: 56,
        padding: 0,
        border: 0,
        borderRadius: 9999,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: TONE_BACKGROUND[tone],
        color: '#ffffff',
        boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  )
}
