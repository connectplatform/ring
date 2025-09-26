'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  readTime: number
  lastUpdated: string
  views: number
  helpful: number
  tags: string[]
  featured: boolean
}

interface InteractiveFeature {
  id: string
  title: string
  description: string
  type: 'code' | 'diagram' | 'tutorial' | 'ai_chat'
  difficulty: string
  duration: string
  popularity: number
}

const mockDocSections: DocSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started with Ring Platform',
    description: 'Complete guide to setting up your first Ring platform instance, from installation to basic configuration.',
    category: 'Setup',
    difficulty: 'beginner',
    readTime: 15,
    lastUpdated: '2025-01-15',
    views: 1250,
    helpful: 89,
    tags: ['setup', 'installation', 'configuration'],
    featured: true
  },
  {
    id: 'customization-guide',
    title: 'Platform Customization Guide',
    description: 'Learn how to customize Ring platform appearance, features, and behavior to match your brand.',
    category: 'Customization',
    difficulty: 'intermediate',
    readTime: 25,
    lastUpdated: '2025-01-12',
    views: 890,
    helpful: 76,
    tags: ['customization', 'branding', 'themes'],
    featured: true
  },
  {
    id: 'api-reference',
    title: 'Ring Platform API Reference',
    description: 'Comprehensive API documentation for developers integrating with Ring platform services.',
    category: 'Development',
    difficulty: 'advanced',
    readTime: 45,
    lastUpdated: '2025-01-10',
    views: 2100,
    helpful: 95,
    tags: ['api', 'development', 'integration'],
    featured: false
  },
  {
    id: 'web3-integration',
    title: 'Web3 Integration Guide',
    description: 'Step-by-step guide to integrating Web3 features including wallets, NFTs, and blockchain interactions.',
    category: 'Web3',
    difficulty: 'intermediate',
    readTime: 30,
    lastUpdated: '2025-01-08',
    views: 1650,
    helpful: 82,
    tags: ['web3', 'blockchain', 'nft', 'wallet'],
    featured: true
  }
]

const interactiveFeatures: InteractiveFeature[] = [
  {
    id: 'code-playground',
    title: 'Interactive Code Playground',
    description: 'Try Ring platform features with our interactive code playground. Write, test, and deploy code snippets.',
    type: 'code',
    difficulty: 'All Levels',
    duration: '15 min',
    popularity: 95
  },
  {
    id: 'architecture-diagrams',
    title: 'Live Architecture Diagrams',
    description: 'Interactive diagrams showing Ring platform architecture, data flow, and component relationships.',
    type: 'diagram',
    difficulty: 'Intermediate',
    duration: '10 min',
    popularity: 87
  },
  {
    id: 'ai-assistant',
    title: 'AI Documentation Assistant',
    description: 'Get instant help with Ring platform features through our AI-powered documentation assistant.',
    type: 'ai_chat',
    difficulty: 'All Levels',
    duration: '5 min',
    popularity: 92
  },
  {
    id: 'video-tutorials',
    title: 'Video Tutorial Series',
    description: 'Step-by-step video tutorials covering Ring platform setup, customization, and advanced features.',
    type: 'tutorial',
    difficulty: 'Beginner',
    duration: '30 min',
    popularity: 88
  }
]

export default function DocumentationHubPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('documentation')

  const filteredDocs = mockDocSections.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter
    const matchesDifficulty = difficultyFilter === 'all' || doc.difficulty === difficultyFilter

    return matchesSearch && matchesCategory && matchesDifficulty
  })

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'green'
      case 'intermediate': return 'yellow'
      case 'advanced': return 'red'
      default: return 'gray'
    }
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-purple-600 mr-3" />
            <h1 className="text-4xl font-bold">Documentation Hub</h1>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Comprehensive documentation system with AI-powered search, interactive examples, and community-driven knowledge base.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-purple-600">200+</div>
              <p className="text-xs text-gray-500">Articles</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">50+</div>
              <p className="text-xs text-gray-500">Interactive Examples</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">1000+</div>
              <p className="text-xs text-gray-500">Community Members</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-orange-600">AI</div>
              <p className="text-xs text-gray-500">Powered Search</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="documentation">Documentation</TabsTrigger>
            <TabsTrigger value="interactive">Interactive Features</TabsTrigger>
            <TabsTrigger value="community">Community</TabsTrigger>
          </TabsList>

          <TabsContent value="documentation" className="space-y-6">
            {/* Search and Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <div className="relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Search documentation..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="Setup">Setup</SelectItem>
                    <SelectItem value="Customization">Customization</SelectItem>
                    <SelectItem value="Development">Development</SelectItem>
                    <SelectItem value="Web3">Web3</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>

                <Button className="bg-purple-600 hover:bg-purple-700">
                  <Lightbulb className="w-4 h-4 mr-2" />
                  AI Search
                </Button>
              </div>
            </div>

            {/* Featured Articles */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4 flex items-center">
                <Star className="w-5 h-5 mr-2 text-yellow-500" />
                Featured Articles
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredDocs.filter(doc => doc.featured).map((doc) => (
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
                        <Badge className={`bg-${getDifficultyColor(doc.difficulty)}-100 text-${getDifficultyColor(doc.difficulty)}-800`}>
                          {doc.difficulty}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center text-sm text-gray-500">
                          <Clock className="w-4 h-4 mr-1" />
                          {doc.readTime} min read
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <Users className="w-4 h-4 mr-1" />
                          {doc.views} views
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 mb-4">
                        {doc.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                          Updated {new Date(doc.lastUpdated).toLocaleDateString()}
                        </div>
                        <Link href={`/docs/${doc.id}`}>
                          <Button size="sm" className="group-hover:bg-purple-600 transition-colors">
                            Read More
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* All Documentation */}
            <div>
              <h2 className="text-2xl font-bold mb-4">All Documentation</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredDocs.map((doc) => (
                  <Card key={doc.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-lg">{doc.title}</h3>
                        <Badge variant="outline" className="text-xs">
                          {doc.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                        {doc.description}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{doc.readTime} min read</span>
                        <span>{doc.views} views</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="interactive" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {interactiveFeatures.map((feature) => (
                <Card key={feature.id} className="group hover:shadow-xl transition-all duration-300">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                        {getFeatureIcon(feature.type)}
                      </div>
                      <div>
                        <CardTitle className="text-lg group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          {feature.title}
                        </CardTitle>
                        <CardDescription>{feature.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-sm font-semibold text-purple-600">{feature.difficulty}</div>
                        <div className="text-xs text-gray-500">Level</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-semibold text-blue-600">{feature.duration}</div>
                        <div className="text-xs text-gray-500">Duration</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-semibold text-green-600">{feature.popularity}%</div>
                        <div className="text-xs text-gray-500">Popular</div>
                      </div>
                    </div>

                    <Button className="w-full group-hover:bg-purple-600 transition-colors">
                      {feature.type === 'ai_chat' ? 'Chat with AI' :
                       feature.type === 'code' ? 'Open Playground' :
                       feature.type === 'diagram' ? 'View Diagrams' : 'Start Tutorial'}
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="community" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Community Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Active Members</span>
                      <span className="font-semibold">1,250</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Monthly Posts</span>
                      <span className="font-semibold">340</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Helpful Answers</span>
                      <span className="font-semibold">890</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Response Time</span>
                      <span className="font-semibold">2.3h</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Discussions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <div className="font-semibold text-sm">Web3 Integration Issues</div>
                      <div className="text-xs text-gray-500">Started 2 hours ago</div>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="font-semibold text-sm">Custom Theme Setup</div>
                      <div className="text-xs text-gray-500">Started 4 hours ago</div>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="font-semibold text-sm">API Authentication</div>
                      <div className="text-xs text-gray-500">Started 6 hours ago</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Contributors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                        A
                      </div>
                      <div>
                        <div className="font-semibold text-sm">Alex Chen</div>
                        <div className="text-xs text-gray-500">150 helpful posts</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                        S
                      </div>
                      <div>
                        <div className="font-semibold text-sm">Sarah Johnson</div>
                        <div className="text-xs text-gray-500">120 helpful posts</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                        M
                      </div>
                      <div>
                        <div className="font-semibold text-sm">Marcus Rodriguez</div>
                        <div className="text-xs text-gray-500">95 helpful posts</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Get Help from Community</CardTitle>
                <CardDescription>Join discussions, ask questions, and help others</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Ask a Question
                  </Button>
                  <Button variant="outline">
                    <Book className="w-4 h-4 mr-2" />
                    Browse Forums
                  </Button>
                  <Button variant="outline">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Top Discussions
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
