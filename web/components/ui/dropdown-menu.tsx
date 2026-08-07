import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, ChevronRight, Circle } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * DropdownMenu component
 * 
 * This is the root component for creating dropdown menus.
 * 
 * User steps:
 * 1. Import and use this component as a wrapper for your dropdown menu structure.
 * 2. Use other exported components like DropdownMenuTrigger and DropdownMenuContent inside this component.
 */
const DropdownMenu = DropdownMenuPrimitive.Root

/**
 * DropdownMenuTrigger component
 * 
 * This component is used to trigger the dropdown menu.
 * 
 * User steps:
 * 1. Use this component to wrap the element that should trigger the dropdown when clicked.
 */
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

/**
 * DropdownMenuGroup component
 * 
 * This component is used to group related items in the dropdown menu.
 * 
 * User steps:
 * 1. Wrap related DropdownMenuItem components with this to create logical groupings.
 */
const DropdownMenuGroup = DropdownMenuPrimitive.Group

/**
 * DropdownMenuPortal component
 * 
 * This component is used to render the dropdown menu in a portal.
 * 
 * User steps:
 * 1. Wrap your DropdownMenuContent with this component if you need to render it in a portal.
 */
const DropdownMenuPortal = DropdownMenuPrimitive.Portal

/**
 * DropdownMenuSub component
 * 
 * This component is used to create nested dropdown menus.
 * 
 * User steps:
 * 1. Use this component to create a submenu within your main dropdown menu.
 */
const DropdownMenuSub = DropdownMenuPrimitive.Sub

/**
 * DropdownMenuRadioGroup component
 * 
 * This component is used to create a group of radio items in the dropdown menu.
 * 
 * User steps:
 * 1. Wrap DropdownMenuRadioItem components with this to create a radio group.
 */
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

/**
 * DropdownMenuSubTrigger component
 * 
 * This component is used as a trigger for nested dropdown menus.
 * 
 * @param className - Additional CSS classes to apply to the component
 * @param inset - Whether to inset the trigger
 * @param children - The content of the trigger
 * 
 * User steps:
 * 1. Use this component to create a trigger for a nested dropdown menu.
 * 2. Place it inside a DropdownMenuSub component.
 */
const DropdownMenuSubTrigger = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent",
      inset && "pl-8",
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName

/**
 * DropdownMenuSubContent component
 * 
 * This component is used to render the content of a nested dropdown menu.
 * 
 * @param className - Additional CSS classes to apply to the component
 * 
 * User steps:
 * 1. Use this component to wrap the content of a nested dropdown menu.
 * 2. Place it inside a DropdownMenuSub component after the DropdownMenuSubTrigger.
 */
const DropdownMenuSubContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
))
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName

/**
 * DropdownMenuContent component
 * 
 * This component is used to render the main content of the dropdown menu.
 * 
 * @param className - Additional CSS classes to apply to the component
 * @param sideOffset - The offset of the content from the trigger
 * 
 * User steps:
 * 1. Use this component to wrap the main content of your dropdown menu.
 * 2. Place it after the DropdownMenuTrigger inside the DropdownMenu component.
 */
const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

/**
 * DropdownMenuItem component
 * 
 * This component is used to render individual items in the dropdown menu.
 * 
 * @param className - Additional CSS classes to apply to the component
 * @param inset - Whether to inset the item
 * 
 * User steps:
 * 1. Use this component for each item in your dropdown menu.
 * 2. Place it inside the DropdownMenuContent component.
 */
const DropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

/**
 * DropdownMenuCheckboxItem component
 * 
 * This component is used to render checkbox items in the dropdown menu.
 * 
 * @param className - Additional CSS classes to apply to the component
 * @param children - The content of the checkbox item
 * @param checked - Whether the checkbox is checked
 * 
 * User steps:
 * 1. Use this component for items that can be toggled on/off in your dropdown menu.
 * 2. Place it inside the DropdownMenuContent component.
 */
const DropdownMenuCheckboxItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName

/**
 * DropdownMenuRadioItem component
 * 
 * This component is used to render radio items in the dropdown menu.
 * 
 * @param className - Additional CSS classes to apply to the component
 * @param children - The content of the radio item
 * 
 * User steps:
 * 1. Use this component for items that are part of a radio group in your dropdown menu.
 * 2. Place it inside a DropdownMenuRadioGroup component.
 */
const DropdownMenuRadioItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

/**
 * DropdownMenuLabel component
 * 
 * This component is used to render labels in the dropdown menu.
 * 
 * @param className - Additional CSS classes to apply to the component
 * @param inset - Whether to inset the label
 * 
 * User steps:
 * 1. Use this component to add labels or section headers in your dropdown menu.
 * 2. Place it inside the DropdownMenuContent component.
 */
const DropdownMenuLabel = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-sm font-semibold",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

/**
 * DropdownMenuSeparator component
 * 
 * This component is used to render separators in the dropdown menu.
 * 
 * @param className - Additional CSS classes to apply to the component
 * 
 * User steps:
 * 1. Use this component to visually separate sections in your dropdown menu.
 * 2. Place it between items inside the DropdownMenuContent component.
 */
const DropdownMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

/**
 * DropdownMenuShortcut component
 * 
 * This component is used to render keyboard shortcuts in the dropdown menu.
 * 
 * @param className - Additional CSS classes to apply to the component
 * 
 * User steps:
 * 1. Use this component to display keyboard shortcuts next to menu items.
 * 2. Place it inside a DropdownMenuItem component.
 */
const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
      {...props}
    />
  )
}
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}

