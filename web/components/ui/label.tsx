import * as React from "react"
import * as labelPrimitive from "@radix-ui/react-label"
import { cn } from "@/lib/utils"

interface LabelProps extends React.ComponentPropsWithoutRef<typeof labelPrimitive.Root> {
  ref?: React.Ref<React.ComponentRef<typeof labelPrimitive.Root>>
}

/**
 * Label component - React 19 optimized with ref as prop
 */
function Label({ className, ref, ...props }: LabelProps) {
  return (
    <labelPrimitive.Root
      ref={ref}
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  )
}

Label.displayName = labelPrimitive.Root.displayName

export { Label }