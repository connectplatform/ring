import * as React from "react"
import { cn } from "@/lib/utils"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>
}

/**
 * Card component - React 19 optimized with ref as prop
 */
function Card({ className, ref, ...props }: CardProps) {
  return (
    <div
      ref={ref}
      className={cn(
        // Use theme tokens directly to ensure correct light/dark rendering
        "rounded-lg border bg-background text-foreground shadow-sm",
        className
      )}
      {...props}
    />
  )
}

Card.displayName = "Card"

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>
}

/**
 * CardHeader component - React 19 optimized with ref as prop
 */
function CardHeader({ className, ref, ...props }: CardHeaderProps) {
  return (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  )
}

CardHeader.displayName = "Card Header"

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  ref?: React.Ref<HTMLHeadingElement>
}

/**
 * CardTitle component - React 19 optimized with ref as prop
 */
function CardTitle({ className, as: Comp = 'h3', ref, ...props }: CardTitleProps) {
  return (
    <Comp
      ref={ref}
      className={cn(
        "text-2xl font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    />
  )
}

CardTitle.displayName = "CardTitle"

interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  ref?: React.Ref<HTMLParagraphElement>
}

/**
 * CardDescription component - React 19 optimized with ref as prop
 */
function CardDescription({ className, ref, ...props }: CardDescriptionProps) {
  return (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

CardDescription.displayName = "CardDescription"

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>
}

/**
 * CardContent component - React 19 optimized with ref as prop
 */
function CardContent({ className, ref, ...props }: CardContentProps) {
  return (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
}

CardContent.displayName = "Card Content"

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>
}

/**
 * CardFooter component - React 19 optimized with ref as prop
 */
function CardFooter({ className, ref, ...props }: CardFooterProps) {
  return (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  )
}

CardFooter.displayName = "Card Footer"

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
}