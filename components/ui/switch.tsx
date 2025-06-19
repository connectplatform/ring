import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  ref?: React.Ref<React.ComponentRef<typeof SwitchPrimitives.Root>>
}

/**
 * Switch component - React 19 optimized with ref as prop
 * 
 * A toggle switch component built on top of Radix UI's Switch primitive.
 * 
 * @component
 * @example
 * // Basic usage
 * <Switch onCheckedChange={(checked) => console.log(checked)} />
 * 
 * // With custom styling
 * <Switch className="custom-switch-class" />
 *
 * User steps:
 * 1. Import the Switch component
 * 2. Use the Switch component in your JSX
 * 3. Optionally, provide an onCheckedChange handler to respond to state changes
 * 4. Optionally, provide custom className for styling
 *
 * @param {Object} props - The component props
 * @param {string} [props.className] - Additional CSS classes to apply to the switch
 * @param {function} [props.onCheckedChange] - Callback function when the switch state changes
 * @param {...any} props - Any other props are passed directly to the underlying Radix UI Switch component
 */
function Switch({ className, ref, ...props }: SwitchProps) {
  return (
    <SwitchPrimitives.Root
      className={cn(
        "peer inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        className
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitives.Root>
  )
}

// Set the display name for the Switch component
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }

