'use client'

import React, { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FloatingSidebarToggleProps {
  children: React.ReactNode
  className?: string
}

export default function FloatingSidebarToggle({ children, className }: FloatingSidebarToggleProps) {
  const [isOpen, setIsOpen] = useState(false)

  const toggleSidebar = () => {
    setIsOpen(!isOpen)
  }

  return (
    <>
      {/* Floating Toggle Button - Only visible on mobile */}
      <div className="lg:hidden fixed top-1/2 right-4 z-50 transform -translate-y-1/2">
        <Button
          onClick={toggleSidebar}
          size="sm"
          variant="secondary"
          className="h-12 w-12 rounded-full shadow-lg bg-background/90 backdrop-blur-sm border border-border hover:bg-background transition-all duration-200"
          aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
        >
          {isOpen ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={cn(
          "lg:hidden fixed top-0 right-0 z-50 h-full w-80 bg-background border-l border-border shadow-2xl transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
          className
        )}
      >
        <div className="p-4 h-full overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  )
}
