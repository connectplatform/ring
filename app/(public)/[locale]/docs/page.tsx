import React from 'react'
import Link from 'next/link'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import RightSidebar from '@/features/layout/components/right-sidebar'
import DesktopSidebar from '@/features/layout/components/desktop-sidebar'
import {
  FileText,
  Search,
  Book,
  Code,
  Zap,
  MessageSquare,
  Star,
  Clock,
  Users,
  TrendingUp,
  Lightbulb,
  Settings,
  Play,
  ChevronRight,
  ExternalLink
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
  const { locale } = await params

  // Redirect to the comprehensive documentation index with mermaid diagrams
  const { redirect } = await import('next/navigation')
  redirect(`/${locale}/docs/library`)

  // This code below is unreachable but kept for reference
  const docsSections: DocSection[] = []
  const docsRoot = path.join(process.cwd(), 'docs', 'content', locale, 'library')

  try {
    if (fs.existsSync(docsRoot)) {
      const sections = fs.readdirSync(docsRoot)

      for (const section of sections) {
        const sectionPath = path.join(docsRoot, section)
        if (fs.statSync(sectionPath).isDirectory()) {
          const files = fs.readdirSync(sectionPath).filter(f => f.endsWith('.mdx'))

          for (const file of files) {
            try {
              const filePath = path.join(sectionPath, file)
              const content = fs.readFileSync(filePath, 'utf8')
              const { data } = matter(content)

              // Use full path as unique ID to avoid duplicates
              const uniqueId = `${section}-${file.replace('.mdx', '')}`
              
              docsSections.push({
                id: uniqueId,
                title: data.title || file.replace('.mdx', ''),
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
  
  const getDifficultyColor = (category: string) => {
    const colors: Record<string, string> = {
      'Getting-started': 'green',
      'Api': 'blue',
      'Features': 'purple',
      'Development': 'orange',
      'Deployment': 'red',
      'Examples': 'indigo',
      'Architecture': 'teal',
      'Customization': 'pink'
    }
    return colors[category.toLowerCase()] || 'gray'
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
    <div className="min-h-screen bg-background">
      {/* Desktop Layout - Hidden on mobile */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-[280px_1fr_320px] gap-6 min-h-screen">
          {/* Left Sidebar - Navigation */}
          <div>
            <DesktopSidebar />
          </div>

          {/* Main Content - Documentation Hub */}
          <div className="container mx-auto px-4 py-8">
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
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">AI</div>
              <p className="text-xs text-muted-foreground">{t.aiPoweredSearch}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Featured Articles */}
          {featuredDocs.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4 flex items-center">
                <Star className="w-5 h-5 mr-2 text-yellow-500" />
                {t.featuredArticles}
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {featuredDocs.slice(0, 4).map((doc) => (
                  <Card key={doc.id} className="group hover:shadow-xl transition-all duration-300">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-xl group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors mb-2">
                            {doc.title}
                          </CardTitle>
                          <CardDescription className="text-sm mb-3 line-clamp-2">
                            {doc.description}
                          </CardDescription>
                        </div>
                        <Badge className={`bg-${getDifficultyColor(doc.category)}-100 text-${getDifficultyColor(doc.category)}-800 dark:bg-${getDifficultyColor(doc.category)}-900 dark:text-${getDifficultyColor(doc.category)}-200`}>
                          {doc.category}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="w-4 h-4 mr-1" />
                          {doc.readTime} {t.minRead}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          {doc.lastUpdated && `${t.updated} ${new Date(doc.lastUpdated).toLocaleDateString()}`}
                        </div>
                        <Link href={`/${locale}/docs/${doc.slug}`}>
                          <Button size="sm" className="group-hover:bg-purple-600 transition-colors">
                            {t.readMore}
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* All Documentation */}
          <div>
            <h2 className="text-2xl font-bold mb-4">{t.allDocumentation}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {docsSections.map((doc) => (
                <Card key={doc.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-lg">{doc.title}</h3>
                      <Badge variant="outline" className="text-xs">
                        {doc.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {doc.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{doc.readTime} {t.minRead}</span>
                      <Link href={`/${locale}/docs/${doc.slug}`}>
                        <Button size="sm" variant="outline">
                          {t.read}
                          <ChevronRight className="w-3 h-3 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          </div>

          {/* Right Sidebar - Documentation Quick Links */}
          <div>
            <RightSidebar title="Quick Links">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Getting Started</h4>
                  <div className="space-y-2">
                    <Link href={`/${locale}/docs/getting-started`} className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                      Installation Guide
                    </Link>
                    <Link href={`/${locale}/docs/quick-start`} className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                      Quick Start
                    </Link>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Popular Topics</h4>
                  <div className="space-y-2">
                    <Link href={`/${locale}/docs/architecture`} className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                      Architecture
                    </Link>
                    <Link href={`/${locale}/docs/api`} className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                      API Reference
                    </Link>
                    <Link href={`/${locale}/docs/deployment`} className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                      Deployment
                    </Link>
                  </div>
                </div>
              </div>
            </RightSidebar>
          </div>
        </div>
      </div>

      {/* Mobile Layout - Hidden on desktop */}
      <div className="lg:hidden">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <FileText className="w-12 h-12 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-4">{t.title}</h1>
            <p className="text-muted-foreground mb-6">
              {t.subtitle}
            </p>
            <p className="text-sm text-muted-foreground">
              Please view this page on a desktop device for the full documentation experience.
            </p>
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}


