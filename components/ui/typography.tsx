import React from 'react'
import { cn } from "@/lib/utils"

interface TypographyProps {
  variant: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p'
  children: React.ReactNode
  className?: string
}

export function Typography({ variant, children, className }: TypographyProps) {
  const Component = variant
  return (
    <Component
      className={cn(
        {
          'scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl': variant === 'h1',
          'scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight transition-colors first:mt-0': variant === 'h2',
          'scroll-m-20 text-2xl font-semibold tracking-tight': variant === 'h3',
          'scroll-m-20 text-xl font-semibold tracking-tight': variant === 'h4',
          'scroll-m-20 text-lg font-semibold tracking-tight': variant === 'h5',
          'scroll-m-20 text-base font-semibold tracking-tight': variant === 'h6',
          'leading-7 [&:not(:first-child)]:mt-6': variant === 'p',
        },
        className
      )}
    >
      {children}
    </Component>
  )
}