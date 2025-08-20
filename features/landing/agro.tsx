'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const AgroLandingPage = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-20">
        <div className="text-center">
          <h1 className="text-6xl font-bold mb-4">AgroGloryTime</h1>
          <p className="text-xl mb-8">Revolutionary Agricultural Investment Platform</p>
          <Button size="lg" asChild>
            <Link href="/opportunities">
              Explore Opportunities
            </Link>
          </Button>
        </div>
        
        <div className="mt-20 text-center">
          <p className="text-lg text-muted-foreground">
            Full landing page content will be restored after BetterAuth migration is complete.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Note: Session integration and advanced features temporarily simplified.
          </p>
        </div>
      </div>
    </div>
  )
}

export default AgroLandingPage