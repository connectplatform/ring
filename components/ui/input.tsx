import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Props interface for the Input component
 * Extends React's InputHTMLAttributes for HTMLInputElement
 */
export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  ref?: React.Ref<HTMLInputElement>
}

/**
 * Input component - React 19 optimized with ref as prop
 * A customizable input field with consistent styling
 *
 * @param props - The input props (extends InputProps)
 * @returns A styled input element
 */
function Input({ className, type, ref, ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
}

Input.displayName = "Input"

export { Input }

