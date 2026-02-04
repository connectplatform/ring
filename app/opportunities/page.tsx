'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Briefcase,
  Search,
  Filter,
  MapPin,
  Calendar,
  DollarSign,
  MessageSquare,
  Star,
  Clock,
  Users,
  Zap
} from 'lucide-react'

interface Opportunity {
  id: string
  title: string
  description: string
  type: 'customization' | 'web3' | 'development' | 'consulting'
  category: string
  budget: string
  deadline: string
  location: string
  client: string
  status: 'open' | 'in_progress' | 'completed'
  skills: string[]
  featured: boolean
  postedAt: string
  applications: number
}

const mockOpportunities: Opportunity[] = [
  {
    id: '1',
    title: 'Ring Platform White-label Implementation',
    description: 'Seeking experienced developer to implement white-label Ring platform for our client. Includes custom branding, feature configuration, and deployment.',
    type: 'customization',
    category: 'Platform Development',
    budget: '$5000 - $8000',
    deadline: '2025-02-15',
    location: 'Remote',
    client: 'TechCorp Solutions',
    status: 'open',
    skills: ['React', 'Next.js', 'Firebase', 'Web3'],
    featured: true,
    postedAt: '2025-01-15',
    applications: 12
  },
  {
    id: '2',
    title: 'NFT Marketplace Integration',
    description: 'Integrate NFT marketplace functionality into existing Ring platform. Requires Web3 expertise and smart contract knowledge.',
    type: 'web3',
    category: 'Blockchain Integration',
    budget: '$3000 - $6000',
    deadline: '2025-02-28',
    location: 'Remote',
    client: 'CryptoVentures',
    status: 'open',
    skills: ['Solidity', 'Web3.js', 'Ethereum', 'NFT'],
    featured: true,
    postedAt: '2025-01-12',
    applications: 8
  },
  {
    id: '3',
    title: 'Ring Analytics Dashboard Development',
    description: 'Build comprehensive analytics dashboard for Ring platform administrators. Include user metrics, performance monitoring, and reporting tools.',
    type: 'development',
    category: 'Dashboard Development',
    budget: '$2500 - $4000',
    deadline: '2025-03-10',
    location: 'Remote',
    client: 'DataInsights Inc',
    status: 'in_progress',
    skills: ['React', 'D3.js', 'Analytics', 'TypeScript'],
    featured: false,
    postedAt: '2025-01-10',
    applications: 15
  },
  {
    id: '4',
    title: 'Ring Platform Security Audit',
    description: 'Comprehensive security audit and penetration testing for Ring platform. Focus on Web3 security and data protection.',
    type: 'consulting',
    category: 'Security Consulting',
    budget: '$4000 - $7000',
    deadline: '2025-02-20',
    location: 'Remote',
    client: 'SecureTech',
    status: 'open',
    skills: ['Security', 'Penetration Testing', 'Web3 Security', 'Auditing'],
    featured: false,
    postedAt: '2025-01-08',
    applications: 6
  }
]

export default function RingOpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>(mockOpportunities)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('newest')

  const filteredOpportunities = opportunities.filter(opp => {
    const matchesSearch = opp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         opp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         opp.skills.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesType = typeFilter === 'all' || opp.type === typeFilter
    const matchesCategory = categoryFilter === 'all' || opp.category === categoryFilter

    return matchesSearch && matchesType && matchesCategory
  }).sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
      case 'budget':
        return parseInt(b.budget.split(' - ')[0].replace('$', '')) - parseInt(a.budget.split(' - ')[0].replace('$', ''))
      case 'deadline':
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      default:
        return 0
    }
  })

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'customization': return 'blue'
      case 'web3': return 'purple'
      case 'development': return 'green'
      case 'consulting': return 'orange'
      default: return 'gray'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'green'
      case 'in_progress': return 'yellow'
      case 'completed': return 'blue'
      default: return 'gray'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-0 py-0">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Briefcase className="w-8 h-8 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold">Ring Opportunities</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Discover Ring customizations and Web3 opportunities. Connect with clients and turn conversations into successful projects.
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search opportunities, skills, or companies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="customization">Customization</SelectItem>
                <SelectItem value="web3">Web3</SelectItem>
                <SelectItem value="development">Development</SelectItem>
                <SelectItem value="consulting">Consulting</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Platform Development">Platform Development</SelectItem>
                <SelectItem value="Blockchain Integration">Blockchain Integration</SelectItem>
                <SelectItem value="Dashboard Development">Dashboard Development</SelectItem>
                <SelectItem value="Security Consulting">Security Consulting</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="budget">Highest Budget</SelectItem>
                <SelectItem value="deadline">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <span className="text-muted-foreground">
              {filteredOpportunities.length} opportunities found
            </span>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-500">Open</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-sm text-gray-500">In Progress</span>
            </div>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Zap className="w-4 h-4 mr-2" />
            Post Opportunity
          </Button>
        </div>

        {/* Opportunities Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredOpportunities.map((opportunity) => (
            <Card key={opportunity.id} className={`relative ${opportunity.featured ? 'ring-2 ring-blue-500' : ''}`}>
              {opportunity.featured && (
                <div className="absolute top-4 right-4 z-10">
                  <Badge className="bg-blue-600 text-white">
                    <Star className="w-3 h-3 mr-1" />
                    Featured
                  </Badge>
                </div>
              )}

              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2">{opportunity.title}</CardTitle>
                    <CardDescription className="text-sm mb-3 line-clamp-2">
                      {opportunity.description}
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center space-x-2 mb-3">
                  <Badge variant="outline" className={`text-${getTypeColor(opportunity.type)}-600 border-${getTypeColor(opportunity.type)}-200`}>
                    {opportunity.type}
                  </Badge>
                  <Badge variant="outline">
                    {opportunity.category}
                  </Badge>
                  <Badge className={`bg-${getStatusColor(opportunity.status)}-100 text-${getStatusColor(opportunity.status)}-800`}>
                    {opportunity.status.replace('_', ' ')}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <DollarSign className="w-4 h-4 mr-1" />
                    {opportunity.budget}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(opportunity.deadline).toLocaleDateString()}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 mr-1" />
                    {opportunity.location}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="w-4 h-4 mr-1" />
                    {opportunity.applications} applications
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex flex-wrap gap-1">
                    {opportunity.skills.slice(0, 4).map((skill) => (
                      <Badge key={skill} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {opportunity.skills.length > 4 && (
                      <Badge variant="secondary" className="text-xs">
                        +{opportunity.skills.length - 4} more
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-gray-500">
                    <Clock className="w-4 h-4 mr-1" />
                    Posted {new Date(opportunity.postedAt).toLocaleDateString()}
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Message
                    </Button>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                      Apply Now
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredOpportunities.length === 0 && (
          <div className="text-center py-12">
            <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-muted-foreground mb-2">
              No opportunities found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Try adjusting your search criteria or check back later for new opportunities.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
