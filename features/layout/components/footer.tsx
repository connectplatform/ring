'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import type { Locale } from '@/i18n-config'
import { Facebook, Twitter, Linkedin, Instagram, BookOpen } from 'lucide-react'

export default function Footer() {
  const t = useTranslations('common.footer')
  const locale = useLocale() as Locale
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-background text-foreground border-t">
      {/* Three-column layout to match page style - 280px navbar + content + 280px right */}
      <div className="hidden lg:grid lg:grid-cols-[280px_1fr_280px] gap-6">
        {/* Left sidebar space - empty (matches 280px left navbar) */}
        <div></div>

        {/* Main footer content */}
        <div className="py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">
                {t('aboutUs')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('aboutUsDescription')}
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">
                {t('quickLinks')}
              </h3>
              <ul className="space-y-2 text-sm">
                <li><Link href={`/${locale}/entities`} className="hover:text-primary transition-colors">
                  {t('entities')}
                </Link></li>
                <li><Link href={`/${locale}/opportunities`} className="hover:text-primary transition-colors">
                  {t('opportunities')}
                </Link></li>
                <li><Link href={`/${locale}/contact`} className="hover:text-primary transition-colors">
                  {t('contacts')}
                </Link></li>
                <li><Link href={`/${locale}/docs`} className="hover:text-primary transition-colors">
                  {t('documentation')}
                </Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">
                {t('contacts')}
              </h3>
              <address className="text-sm text-muted-foreground not-italic">
                <p>{t('addressFull')}</p>
                <p className="mt-2">
                  <a href="mailto:contact@ring.ck.ua" className="hover:text-primary transition-colors">
                    {t('emailFull')}
                  </a>
                </p>
                <p className="mt-2">
                  <a href="tel:+380975328801" className="hover:text-primary transition-colors">
                    {t('phoneFull')}
                  </a>
                </p>
              </address>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">
                {t('followUs')}
              </h3>
              <div className="flex space-x-4">
                <a href="#" aria-label="Facebook" className="text-muted-foreground hover:text-primary transition-colors">
                  <Facebook className="w-6 h-6" />
                </a>
                <a href="#" aria-label="Twitter" className="text-muted-foreground hover:text-primary transition-colors">
                  <Twitter className="w-6 h-6" />
                </a>
                <a href="#" aria-label="LinkedIn" className="text-muted-foreground hover:text-primary transition-colors">
                  <Linkedin className="w-6 h-6" />
                </a>
                <a href="#" aria-label="Instagram" className="text-muted-foreground hover:text-primary transition-colors">
                  <Instagram className="w-6 h-6" />
                </a>
                <a href="https://connectplatform.github.io/ring" target="_blank" rel="noopener noreferrer" aria-label="Ring Documentation" className="text-muted-foreground hover:text-primary transition-colors">
                  <BookOpen className="w-6 h-6" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar space - empty (matches right margin) */}
        <div></div>
      </div>

      {/* Mobile Layout - Single footer for all screen sizes */}
      <div className="lg:hidden container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">
              {t('aboutUs')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('aboutUsDescription')}
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">
              {t('quickLinks')}
            </h3>
            <ul className="space-y-2 text-sm">
              <li><Link href={`/${locale}/entities`} className="hover:text-primary transition-colors">
                {t('entities')}
              </Link></li>
              <li><Link href={`/${locale}/opportunities`} className="hover:text-primary transition-colors">
                {t('opportunities')}
              </Link></li>
              <li><Link href={`/${locale}/contact`} className="hover:text-primary transition-colors">
                {t('contacts')}
              </Link></li>
              <li><Link href={`/${locale}/docs`} className="hover:text-primary transition-colors">
                {t('documentation')}
              </Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">
              {t('contacts')}
            </h3>
            <address className="text-sm text-muted-foreground not-italic">
              <p>{t('addressFull')}</p>
              <p className="mt-2">
                <a href="mailto:contact@ring.ck.ua" className="hover:text-primary transition-colors">
                  {t('emailFull')}
                </a>
              </p>
              <p className="mt-2">
                <a href="tel:+380975328801" className="hover:text-primary transition-colors">
                  {t('phoneFull')}
                </a>
              </p>
            </address>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">
              {t('followUs')}
            </h3>
            <div className="flex space-x-4">
              <a href="#" aria-label="Facebook" className="text-muted-foreground hover:text-primary transition-colors">
                <Facebook className="w-6 h-6" />
              </a>
              <a href="#" aria-label="Twitter" className="text-muted-foreground hover:text-primary transition-colors">
                <Twitter className="w-6 h-6" />
              </a>
              <a href="#" aria-label="LinkedIn" className="text-muted-foreground hover:text-primary transition-colors">
                <Linkedin className="w-6 h-6" />
              </a>
              <a href="#" aria-label="Instagram" className="text-muted-foreground hover:text-primary transition-colors">
                <Instagram className="w-6 h-6" />
              </a>
              <a href="https://connectplatform.github.io/ring" target="_blank" rel="noopener noreferrer" aria-label="Ring Documentation" className="text-muted-foreground hover:text-primary transition-colors">
                <BookOpen className="w-6 h-6" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright section - spans full width on all screens */}
      <div className="border-t border-muted">
        <div className="container mx-auto px-4 lg:px-6 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground text-center sm:text-left">
              {t('copyright', { year: currentYear.toString() })}
            </p>
            <div className="flex flex-wrap justify-center sm:justify-end items-center gap-4">
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {t('privacyPolicy')}
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {t('termsOfService')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}