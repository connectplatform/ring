import React from 'react'
import Link from 'next/link'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import RightSidebar from '@/features/layout/components/right-sidebar'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import DocsWrapper from '@/components/wrappers/docs-wrapper'
import { isValidLocale, defaultLocale, type Locale } from '@/i18n-config'

// Route segment configuration for docs hub page
import {
  FileText,
  Search,
  Book,
  Code,
  Zap,
  MessageSquare,
  Play,
  Clock
} from 'lucide-react'

interface DocSection {
  id: string
  title: string
  description: string
  category: string
  slug: string
  readTime?: number
  lastUpdated?: string
  featured?: boolean
}

interface PageProps {
  params: Promise<{
    locale: string
  }>
}

export default async function DocumentationHubPage({ params }: PageProps) {
  // Await params to avoid sync dynamic API error
  const { locale: rawLocale } = await params
  const locale = isValidLocale(rawLocale) ? rawLocale : defaultLocale

  const docsDirectory = path.join(process.cwd(), 'content/docs')

  const docsSections: DocSection[] = []

  try {
    if (fs.existsSync(docsDirectory)) {
      const sections = fs.readdirSync(docsDirectory, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)

      for (const section of sections) {
        const sectionPath = path.join(docsDirectory, section)
        const files = fs.readdirSync(sectionPath)

        for (const file of files) {
          if (file.endsWith('.mdx')) {
            try {
              const filePath = path.join(sectionPath, file)
              const fileContents = fs.readFileSync(filePath, 'utf8')
              const { data } = matter(fileContents)

              docsSections.push({
                id: `${section}-${file}`,
                title: data.title || 'Untitled',
                description: data.description || '',
                category: section.charAt(0).toUpperCase() + section.slice(1),
                slug: file === 'index.mdx' ? section : `${section}/${file.replace('.mdx', '')}`,
                readTime: data.readTime || 5,
                lastUpdated: data.lastUpdated || new Date().toISOString().split('T')[0],
                featured: data.featured || false
              })
            } catch (error) {
              console.error(`Error reading ${file}:`, error)
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error reading docs:', error)
  }

  const featuredDocs = docsSections.filter(doc => doc.featured)

  const getCategoryBadgeClasses = (category: string) => {
    const classes: Record<string, string> = {
      'Getting-started': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Api': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Features': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'Development': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'Deployment': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'Examples': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      'Architecture': 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
      'Customization': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200'
    }
    return classes[category] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }

  const getFeatureIcon = (type: string) => {
    switch (type) {
      case 'code': return <Code className="w-5 h-5" />
      case 'diagram': return <Zap className="w-5 h-5" />
      case 'tutorial': return <Play className="w-5 h-5" />
      case 'ai_chat': return <MessageSquare className="w-5 h-5" />
      default: return <FileText className="w-5 h-5" />
    }
  }

  // Localized content
  const t = {
    title: locale === 'uk' ? 'Центр документації' : 'Documentation Hub',
    subtitle: locale === 'uk'
      ? 'Комплексна система документації з пошуком на основі ШІ, інтерактивними прикладами та базою знань, що підтримується спільнотою.'
      : 'Comprehensive documentation system with AI-powered search, interactive examples, and community-driven knowledge base.',
    articles: locale === 'uk' ? 'Статей' : 'Articles',
    categories: locale === 'uk' ? 'Категорії' : 'Categories',
    languages: locale === 'uk' ? 'Мови' : 'Languages',
    aiPoweredSearch: locale === 'uk' ? 'Пошук з ШІ' : 'AI Powered Search',
    featuredArticles: locale === 'uk' ? 'Популярні статті' : 'Featured Articles',
    allDocumentation: locale === 'uk' ? 'Вся документація' : 'All Documentation',
    minRead: locale === 'uk' ? 'хв читання' : 'min read',
    updated: locale === 'uk' ? 'Оновлено' : 'Updated',
    readMore: locale === 'uk' ? 'Читати далі' : 'Read More',
    read: locale === 'uk' ? 'Читати' : 'Read'
  }

  return (
    <DocsWrapper locale={locale as Locale}>
      {/* Main Content - Documentation Hub */}
      <div className="container mx-auto px-0 py-0">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-primary mr-3" />
            <h1 className="text-4xl font-bold text-foreground">{t.title}</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            {t.subtitle}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{docsSections.length}+</div>
              <p className="text-xs text-muted-foreground">{t.articles}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">8</div>
              <p className="text-xs text-muted-foreground">{t.categories}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">3</div>
              <p className="text-xs text-muted-foreground">{t.languages}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">AI</div>
              <p className="text-xs text-muted-foreground">{t.aiPoweredSearch}</p>
            </CardContent>
          </Card>
        </div>

        {/* Featured Articles */}
        {featuredDocs.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">{t.featuredArticles}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {featuredDocs.map((doc) => (
                <Card key={doc.slug} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      {doc.title}
                    </CardTitle>
                    <CardDescription>{doc.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Badge variant="outline" className="text-xs">
                        {doc.category}
                      </Badge>
                      {doc.readTime && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="w-4 h-4 mr-1" />
                          {doc.readTime} {t.minRead}
                        </div>
                      )}
                      <Button asChild className="w-full">
                        <Link href={`/${locale}/docs/${doc.slug}`}>{t.readMore}</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* All Documentation */}
        <div>
          <h2 className="text-2xl font-bold mb-6">{t.allDocumentation}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {docsSections.map((doc) => (
              <Card key={doc.slug} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    {doc.title}
                  </CardTitle>
                  <CardDescription>{doc.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Badge variant="outline" className="text-xs">
                      {doc.category}
                    </Badge>
                    {doc.readTime && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="w-4 h-4 mr-1" />
                        {doc.readTime} {t.minRead}
                      </div>
                    )}
                    <Button asChild className="w-full">
                      <Link href={`/${locale}/docs/${doc.slug}`}>{t.read}</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Right Sidebar - Quick Links */}
      <RightSidebar title="Quick Links">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Getting Started</h4>
            <div className="space-y-2">
              <Link href={`/${locale}/docs/getting-started`} className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                Getting Started
              </Link>
              <Link href={`/${locale}/docs/api-reference`} className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                API Reference
              </Link>
              <Link href={`/${locale}/docs/best-practices`} className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                Best Practices
              </Link>
            </div>
          </div>
        </div>
      </RightSidebar>

      {/* iPad Layout - Floating Sidebar */}
      <FloatingSidebarToggle>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Getting Started</h4>
            <div className="space-y-2">
              <Link href={`/${locale}/docs/getting-started`} className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                Getting Started
              </Link>
              <Link href={`/${locale}/docs/api-reference`} className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                API Reference
              </Link>
            </div>
          </div>
        </div>
      </FloatingSidebarToggle>

      {/* Mobile Layout */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Please view this page on a desktop device for the full documentation experience.
        </p>
      </div>
    </DocsWrapper>
  )
}