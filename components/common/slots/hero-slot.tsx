'use client'
import React from 'react'
import Link from 'next/link'
import { useInstanceConfig } from '@/hooks/use-instance-config'

export default function HeroSlot() {
  const cfg = useInstanceConfig()
  const hero = cfg.hero || {}
  if (!hero.showOnHome) return null
  return (
    <section className="w-full bg-gradient-to-br from-primary/10 to-accent/10 py-12" data-hero-parallax data-hero-animate="fade-in">
      <div className="mx-auto max-w-5xl px-4 text-center" data-hero-animate="slide-up">
        <h1 className="text-3xl md:text-5xl font-bold mb-4 text-primary" data-hero-animate="scale-in">{hero.title}</h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-6" data-hero-animate="fade-in">{hero.subtitle}</p>
        {hero.ctaText && hero.ctaHref && (
          <Link href={hero.ctaHref} className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-md hover:opacity-90" data-hero-animate="scale-in">
            {hero.ctaText}
          </Link>
        )}
      </div>
    </section>
  )
}
