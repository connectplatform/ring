'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import type { Locale } from '@/i18n-config'
import { Facebook, Twitter, Linkedin, Instagram, BookOpen } from 'lucide-react'

export default function Footer() {
  const t = useTranslations('common.footer')
  const locale = useLocale() as Locale
  const [mounted, setMounted] = useState(false)
  const currentYear = new Date().getFullYear()

  // Fix hydration mismatch by only rendering dynamic content after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <footer className="bg-background text-foreground border-t">
      {/* Three-column layout to match page style */}
      <div className="grid grid-cols-[320px_1fr_320px] gap-6">
        {/* Left sidebar space - empty */}
        <div className="hidden lg:block"></div>

        {/* Main footer content */}
        <div className="lg:ml-0 lg:mr-0 mr-4 ml-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">
                {mounted ? t('aboutUs') : 'About Us'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {mounted ? t('aboutUsDescription') : 'About our platform and services'}
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">
                {mounted ? t('quickLinks') : 'Quick Links'}
              </h3>
              <ul className="space-y-2 text-sm">
                <li><Link href={`/${locale}/entities`} className="hover:text-primary transition-colors">
                  {mounted ? t('entities') : 'Entities'}
                </Link></li>
                <li><Link href={`/${locale}/opportunities`} className="hover:text-primary transition-colors">
                  {mounted ? t('opportunities') : 'Opportunities'}
                </Link></li>
                <li><Link href={`/${locale}/contact`} className="hover:text-primary transition-colors">
                  {mounted ? t('contacts') : 'Contact'}
                </Link></li>
                <li><Link href={`/${locale}/docs`} className="hover:text-primary transition-colors">
                  {mounted ? t('documentation') : 'Documentation'}
                </Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">
                {mounted ? t('contacts') : 'Contact'}
              </h3>
              <address className="text-sm text-muted-foreground not-italic">
                <p>{mounted ? t('addressFull') : 'Address'}</p>
                <p className="mt-2">
                  <a href="mailto:contact@ring.ck.ua" className="hover:text-primary transition-colors">
                    {mounted ? t('emailFull') : 'contact@ring.ck.ua'}
                  </a>
                </p>
                <p className="mt-2">
                  <a href="tel:+380975328801" className="hover:text-primary transition-colors">
                    {mounted ? t('phoneFull') : '+38 097 532 8801'}
                  </a>
                </p>
              </address>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">
                {mounted ? t('followUs') : 'Follow Us'}
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

        {/* Right sidebar space - empty */}
        <div className="hidden lg:block"></div>
      </div>

      {/* Copyright section spanning full width */}
      <div className="border-t border-muted">
        <div className="px-6 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-4">
              <p className="text-sm text-muted-foreground">
                {mounted ? t('copyright', { year: currentYear.toString() }) : `© ${currentYear} Ring`}
              </p>
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {mounted ? t('privacyPolicy') : 'Privacy Policy'}
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {mounted ? t('termsOfService') : 'Terms of Service'}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Layout - Stack vertically */}
      <div className="lg:hidden">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">
                {mounted ? t('aboutUs') : 'About Us'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {mounted ? t('aboutUsDescription') : 'About our platform and services'}
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">
                {mounted ? t('quickLinks') : 'Quick Links'}
              </h3>
              <ul className="space-y-2 text-sm">
                <li><Link href={`/${locale}/entities`} className="hover:text-primary transition-colors">
                  {mounted ? t('entities') : 'Entities'}
                </Link></li>
                <li><Link href={`/${locale}/opportunities`} className="hover:text-primary transition-colors">
                  {mounted ? t('opportunities') : 'Opportunities'}
                </Link></li>
                <li><Link href={`/${locale}/contact`} className="hover:text-primary transition-colors">
                  {mounted ? t('contacts') : 'Contact'}
                </Link></li>
                <li><Link href={`/${locale}/docs`} className="hover:text-primary transition-colors">
                  {mounted ? t('documentation') : 'Documentation'}
                </Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">
                {mounted ? t('contacts') : 'Contact'}
              </h3>
              <address className="text-sm text-muted-foreground not-italic">
                <p>{mounted ? t('addressFull') : 'Address'}</p>
                <p className="mt-2">
                  <a href="mailto:contact@ring.ck.ua" className="hover:text-primary transition-colors">
                    {mounted ? t('emailFull') : 'contact@ring.ck.ua'}
                  </a>
                </p>
                <p className="mt-2">
                  <a href="tel:+380975328801" className="hover:text-primary transition-colors">
                    {mounted ? t('phoneFull') : '+38 097 532 8801'}
                  </a>
                </p>
              </address>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">
                {mounted ? t('followUs') : 'Follow Us'}
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
          <div className="mt-12 pt-8 border-t border-muted flex flex-col md:flex-row justify-between items-center">
            <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-4">
              <p className="text-sm text-muted-foreground">
                {mounted ? t('copyright', { year: currentYear.toString() }) : `© ${currentYear} Ring`}
              </p>
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {mounted ? t('privacyPolicy') : 'Privacy Policy'}
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {mounted ? t('termsOfService') : 'Terms of Service'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
