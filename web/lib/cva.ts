const cva = <T extends Record<string, Record<string, string>>>(
  base: string,
  config: { variants: T; defaultVariants?: Partial<{ [K in keyof T]: keyof T[K] }> }
) => {
  return (props?: { [K in keyof T]?: keyof T[K] } & { className?: string }): string => {
    const classes = [base]
    const { variants, defaultVariants = {} } = config

    for (const key of Object.keys(variants)) {
      const value = (props as any)?.[key] || defaultVariants[key]
      if (value && variants[key][value]) {
        classes.push(variants[key][value])
      }
    }

    if (props?.className) classes.push(props.className)
    return classes.filter(Boolean).join(' ')
  }
}

type CvaReturn<T extends Record<string, Record<string, string>>> =
  (props?: { [K in keyof T]?: keyof T[K] } & { className?: string }) => string

type VariantProps<T extends CvaReturn<any>> =
  Parameters<T>[0] extends infer P
    ? P extends { className?: string }
      ? Omit<P, 'className'>
      : P extends undefined
        ? Record<string, never>
        : P
    : Record<string, never>

export { cva }
export type { VariantProps, CvaReturn }
