'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/node_modules/react-i18next'
import { useTheme } from 'next-themes'
import { Moon, Sun, Facebook, Twitter, Linkedin, Instagram, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import packageInfo from '@/package.json'

export default function footer() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const currentYear = new Date().getFullYear()

  // Fix hydration mismatch by only rendering dynamic content after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'uk' : 'en'
    i18n.changeLanguage(newLang)
  }

  return (
    <footer className="bg-background text-foreground border-t">
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
              <li><Link href="/directory" className="hover:text-primary transition-colors">
                {mounted ? t('catalog') : 'Catalog'}
              </Link></li>
              <li><Link href="/opportunities" className="hover:text-primary transition-colors">
                {mounted ? t('opportunities') : 'Opportunities'}
              </Link></li>
              <li><Link href="/contact" className="hover:text-primary transition-colors">
                {mounted ? t('contacts') : 'Contact'}
              </Link></li>
              <li><Link href="/privacy" className="hover:text-primary transition-colors">
                {mounted ? t('privacyPolicy') : 'Privacy Policy'}
              </Link></li>
              <li><Link href="/terms" className="hover:text-primary transition-colors">
                {mounted ? t('termsOfService') : 'Terms of Service'}
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
          </div>
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            {mounted ? (
              <Button variant="ghost" size="sm" onClick={toggleLanguage} className="h-8 px-2">
                {i18n.language === 'en' ? 'EN' : 'UK'}
                <span className="sr-only">{t('toggleLanguage')}</span>
              </Button>
            ) : (
              <div className="w-12 h-8 animate-pulse bg-gray-200 dark:bg-gray-700 rounded"></div>
            )}
            {mounted ? (
              <Button variant="ghost" size="sm" onClick={toggleTheme} className="h-8 w-8 px-0">
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span className="sr-only">{t('toggleTheme')}</span>
              </Button>
            ) : (
              <div className="w-8 h-8 animate-pulse bg-gray-200 dark:bg-gray-700 rounded"></div>
            )}
          </div>
        </div>
        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground">v{packageInfo.version}</p>
        </div>
      </div>
    </footer>
  )
}
