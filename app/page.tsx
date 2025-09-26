import React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  Briefcase,
  Store,
  FileText,
  MessageSquare,
  Wallet,
  Zap,
  Globe,
  Code,
  TrendingUp,
  Star,
  ArrowRight,
  ExternalLink
} from 'lucide-react'

const portalFeatures = [
  {
    id: 'opportunities',
    title: 'Ring Opportunities',
    description: 'Discover Ring customizations and Web3 opportunities. Connect with clients and turn conversations into successful projects.',
    icon: Briefcase,
    href: '/opportunities',
    color: 'blue',
    stats: '150+ Active Projects'
  },
  {
    id: 'marketplace',
    title: 'MV Marketplace',
    description: 'Vendor marketplace for Ring-powered site development and services. Become a MEMBER-level vendor and offer your expertise.',
    icon: Store,
    href: '/marketplace',
    color: 'green',
    stats: '50+ Verified Vendors'
  },
  {
    id: 'documentation',
    title: 'Documentation Hub',
    description: 'Comprehensive documentation system with AI-powered search, interactive examples, and community-driven knowledge base.',
    icon: FileText,
    href: '/docs',
    color: 'purple',
    stats: '200+ Articles'
  },
  {
    id: 'networking',
    title: 'Professional Networking',
    description: 'Connect with tech professionals, share opportunities, and build lasting partnerships in the Ring ecosystem.',
    icon: Users,
    href: '/entities',
    color: 'orange',
    stats: '1000+ Members'
  },
  {
    id: 'messaging',
    title: 'Real-time Messaging',
    description: 'Secure, encrypted messaging with tunnel transport for professional communications and project discussions.',
    icon: MessageSquare,
    href: '/messages',
    color: 'red',
    stats: 'Real-time Updates'
  },
  {
    id: 'wallet',
    title: 'Dual-Token Wallet',
    description: 'Manage JWT utility tokens for p2p transfers and RING tokens for premium features and governance.',
    icon: Wallet,
    href: '/wallet',
    color: 'yellow',
    stats: 'Multi-token Support'
  }
]

const tokenSystem = [
  {
    name: 'JWT Token',
    description: 'Utility token for p2p transfers, goods, and services',
    features: ['P2P Payments', 'Service Fees', 'Marketplace Transactions'],
    color: 'blue'
  },
  {
    name: 'RING Token',
    description: 'Premium token for governance and exclusive features',
    features: ['Premium Access', 'Governance Rights', 'Staking Rewards'],
    color: 'green'
  }
]

export default function RingPlatformPortal() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center mr-4">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              Ring Platform
            </h1>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            The central hub for Ring ecosystem - connecting opportunities, vendors, developers, and innovators
            in a unified platform powered by Web3 technology and AI-driven insights.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              <Code className="w-4 h-4 mr-1" />
              Next.js 15 + React 19
            </Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1">
              <Globe className="w-4 h-4 mr-1" />
              Web3 Integration
            </Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1">
              <Star className="w-4 h-4 mr-1" />
              AI-Powered
            </Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1">
              <TrendingUp className="w-4 h-4 mr-1" />
              Real-time Updates
            </Badge>
          </div>
        </div>

        {/* Main Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {portalFeatures.map((feature) => {
            const Icon = feature.icon
            return (
              <Card key={feature.id} className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-blue-200 dark:hover:border-blue-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 bg-${feature.color}-100 dark:bg-${feature.color}-900 rounded-lg flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 text-${feature.color}-600 dark:text-${feature.color}-400`} />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {feature.stats}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {feature.title}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={feature.href}>
                    <Button className="w-full group-hover:bg-blue-600 transition-colors">
                      Explore
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Token System Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">Dual-Token Ecosystem</h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Powering transactions and governance with JWT utility tokens and RING premium tokens
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {tokenSystem.map((token, index) => (
              <div key={token.name} className="bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-700 dark:to-gray-600 rounded-xl p-6">
                <div className="flex items-center mb-4">
                  <div className={`w-10 h-10 bg-${token.color}-500 rounded-full flex items-center justify-center mr-3`}>
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold">{token.name}</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-4">{token.description}</p>
                <ul className="space-y-2">
                  {token.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center text-sm">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="text-center">
          <h3 className="text-2xl font-bold mb-6">Get Started</h3>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/auth/signin">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                Sign In
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button size="lg" variant="outline">
                Join Ring
                <Users className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/docs/getting-started">
              <Button size="lg" variant="ghost">
                Documentation
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}