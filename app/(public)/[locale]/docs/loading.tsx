// app/(public)/[locale]/docs/loading.tsx
import Image from 'next/image'

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <Image
            src="/logo.svg"
            alt="Ring Platform Logo"
            width={64}
            height={64}
            className="w-16 h-16 animate-pulse"
          />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            Loading Documentation Hub...
          </h2>
          <p className="text-sm text-muted-foreground">
            Scanning documentation library
          </p>
        </div>
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
        </div>
      </div>
    </div>
  )
}