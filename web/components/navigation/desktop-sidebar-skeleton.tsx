/**
 * Instant paint shell for desktop sidebar while the client chunk hydrates.
 * Layout matches SidebarSyncedLayout rail + aside so CLS stays near zero.
 */
export function DesktopSidebarSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={
        className ??
        'fixed z-40 hidden md:flex inset-y-0 left-0 h-[100dvh]'
      }
      aria-hidden
      data-testid="desktop-sidebar-skeleton"
    >
      <div
        className="relative flex h-full min-h-[100dvh] flex-col"
        style={{
          width:
            'calc(var(--sidebar-rail-w, 4rem) + clamp(0px, var(--sidebar-aside-w, 14rem), 320px))',
        }}
      >
        <div className="grid h-full min-h-0 grid-cols-[64px_minmax(0,1fr)]">
          {/* Rail strip */}
          <div className="flex flex-col gap-3 bg-[#090909] px-2 py-4">
            <div className="mx-auto size-10 animate-pulse rounded-full bg-white/10" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="mx-auto size-6 animate-pulse rounded-md bg-white/10"
                style={{ animationDelay: `${i * 40}ms` }}
              />
            ))}
          </div>
          {/* Aside labels */}
          <div className="flex flex-col gap-3 border-r border-border/40 bg-background/80 px-3 py-4 backdrop-blur-sm">
            <div className="mb-2 h-8 w-36 animate-pulse rounded bg-muted" />
            {/* Profile row: name + credit chip skeleton */}
            <div className="flex h-11 items-center justify-between gap-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="flex items-center gap-1">
                <div className="size-3.5 animate-pulse rounded bg-muted" />
                <div className="h-3.5 w-10 animate-pulse rounded bg-muted" />
                <div className="h-2.5 w-8 animate-pulse rounded bg-muted" />
              </div>
            </div>
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="h-4 animate-pulse rounded bg-muted"
                style={{ width: `${55 + (i % 3) * 12}%`, animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
