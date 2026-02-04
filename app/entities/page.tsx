'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Users,
  Search,
  MapPin,
  Building,
  MessageSquare,
  Star,
  CheckCircle,
  Filter,
  Briefcase,
  Award,
  TrendingUp
} from 'lucide-react'

interface Entity {
  id: string
  name: string
  type: 'company' | 'individual' | 'organization'
  avatar: string
  title: string
  location: string
  industry: string
  description: string
  skills: string[]
  rating: number
  reviews: number
  verified: boolean
  featured: boolean
  memberSince: string
  connections: number
  completedProjects: number
  specializations: string[]
  availability: 'available' | 'busy' | 'unavailable'
}

const mockEntities: Entity[] = [
  {
    id: '1',
    name: 'TechCorp Solutions',
    type: 'company',
    avatar: '/companies/techcorp.jpg',
    title: 'Enterprise Software Solutions',
    location: 'Kyiv, Ukraine',
    industry: 'Technology',
    description: 'Leading provider of enterprise software solutions with 10+ years of experience in custom development and digital transformation.',
    skills: ['Custom Development', 'Cloud Solutions', 'Digital Transformation', 'API Integration'],
    rating: 4.9,
    reviews: 156,
    verified: true,
    featured: true,
    memberSince: '2020-03-15',
    connections: 450,
    completedProjects: 89,
    specializations: ['Enterprise Software', 'Cloud Migration', 'Digital Strategy'],
    availability: 'available'
  },
  {
    id: '2',
    name: 'Alex Chen',
    type: 'individual',
    avatar: '/avatars/alex.jpg',
    title: 'Senior Ring Developer',
    location: 'San Francisco, CA',
    industry: 'Software Development',
    description: 'Full-stack developer specializing in Ring platform customization and Web3 integration with 8+ years of experience.',
    skills: ['React', 'Next.js', 'Web3', 'Solidity', 'TypeScript', 'Node.js'],
    rating: 4.8,
    reviews: 127,
    verified: true,
    featured: true,
    memberSince: '2021-01-20',
    connections: 320,
    completedProjects: 67,
    specializations: ['Ring Customization', 'Web3 Integration', 'Full-stack Development'],
    availability: 'available'
  },
  {
    id: '3',
    name: 'InnovateLab',
    type: 'organization',
    avatar: '/companies/innovatelab.jpg',
    title: 'Innovation & Research Center',
    location: 'Berlin, Germany',
    industry: 'Research & Development',
    description: 'Research organization focused on emerging technologies including blockchain, AI, and decentralized systems.',
    skills: ['Blockchain Research', 'AI/ML', 'Decentralized Systems', 'Innovation Strategy'],
    rating: 4.7,
    reviews: 93,
    verified: true,
    featured: false,
    memberSince: '2019-11-08',
    connections: 680,
    completedProjects: 45,
    specializations: ['Technology Research', 'Innovation Consulting', 'Strategic Planning'],
    availability: 'available'
  },
  {
    id: '4',
    name: 'Sarah Johnson',
    type: 'individual',
    avatar: '/avatars/sarah.jpg',
    title: 'Ring Platform Consultant',
    location: 'London, UK',
    industry: 'Consulting',
    description: 'Certified Ring platform consultant helping businesses implement and optimize their Ring-powered solutions.',
    skills: ['Ring Platform', 'System Architecture', 'Project Management', 'Business Analysis'],
    rating: 5.0,
    reviews: 89,
    verified: true,
    featured: false,
    memberSince: '2022-05-12',
    connections: 290,
    completedProjects: 34,
    specializations: ['Ring Consulting', 'Implementation Strategy', 'Performance Optimization'],
    availability: 'busy'
  }
]

export default function EntitiesPage() {
  const [entities, setEntities] = useState<Entity[]>(mockEntities)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [industryFilter, setIndustryFilter] = useState<string>('all')
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('rating')

  const filteredEntities = entities.filter(entity => {
    const searchableText = `${entity.name} ${entity.title} ${entity.description} ${entity.skills.join(' ')} ${entity.specializations.join(' ')}`
    const matchesSearch = searchableText.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesType = typeFilter === 'all' || entity.type === typeFilter
    const matchesIndustry = industryFilter === 'all' || entity.industry === industryFilter
    const matchesAvailability = availabilityFilter === 'all' || entity.availability === availabilityFilter

    return matchesSearch && matchesType && matchesIndustry && matchesAvailability
  }).sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        return b.rating - a.rating
      case 'reviews':
        return b.reviews - a.reviews
      case 'projects':
        return b.completedProjects - a.completedProjects
      case 'connections':
        return b.connections - a.connections
      default:
        return 0
    }
  })

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'company': return <Building className="w-4 h-4" />
      case 'individual': return <Users className="w-4 h-4" />
      case 'organization': return <Award className="w-4 h-4" />
      default: return <Users className="w-4 h-4" />
    }
  }

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'available': return 'green'
      case 'busy': return 'yellow'
      case 'unavailable': return 'gray'
      default: return 'gray'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-0 py-0">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-orange-600 mr-3" />
            <h1 className="text-4xl font-bold">Professional Networking</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Connect with tech professionals, share opportunities, and build lasting partnerships in the Ring ecosystem.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-orange-600">{entities.length}</div>
              <p className="text-xs text-gray-500">Total Entities</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">
                {entities.filter(e => e.verified).length}
              </div>
              <p className="text-xs text-gray-500">Verified</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {entities.filter(e => e.availability === 'available').length}
              </div>
              <p className="text-xs text-gray-500">Available Now</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-purple-600">
                {entities.reduce((sum, e) => sum + e.completedProjects, 0)}
              </div>
              <p className="text-xs text-gray-500">Projects Completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search entities, skills, or companies..."
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
                <SelectItem value="company">Companies</SelectItem>
                <SelectItem value="individual">Individuals</SelectItem>
                <SelectItem value="organization">Organizations</SelectItem>
              </SelectContent>
            </Select>

            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Industries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                <SelectItem value="Technology">Technology</SelectItem>
                <SelectItem value="Software Development">Software Development</SelectItem>
                <SelectItem value="Consulting">Consulting</SelectItem>
                <SelectItem value="Research & Development">Research & Development</SelectItem>
              </SelectContent>
            </Select>

            <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Availability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Availability</SelectItem>
                <SelectItem value="available">Available Now</SelectItem>
                <SelectItem value="busy">Currently Busy</SelectItem>
                <SelectItem value="unavailable">Unavailable</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="reviews">Most Reviews</SelectItem>
                <SelectItem value="projects">Most Projects</SelectItem>
                <SelectItem value="connections">Most Connections</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <span className="text-muted-foreground">
              {filteredEntities.length} entities found
            </span>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-gray-500">Verified</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-500">Available</span>
            </div>
          </div>
          <Button className="bg-orange-600 hover:bg-orange-700">
            <Users className="w-4 h-4 mr-2" />
            Join Network
          </Button>
        </div>

        {/* Entities Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredEntities.map((entity) => (
            <Card key={entity.id} className={`relative ${entity.featured ? 'ring-2 ring-orange-500' : ''}`}>
              {entity.featured && (
                <div className="absolute top-4 right-4 z-10">
                  <Badge className="bg-orange-600 text-white">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Featured
                  </Badge>
                </div>
              )}

              <CardHeader>
                <div className="flex items-start space-x-4">
                  <Avatar
                    src={entity.avatar}
                    alt={entity.name}
                    fallback={entity.name.split(' ').map(n => n[0]).join('')}
                    className="w-16 h-16"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <CardTitle className="text-xl">{entity.name}</CardTitle>
                      {entity.verified && (
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                      )}
                      <div className={`flex items-center space-x-1 text-sm px-2 py-1 rounded-full ${
                        entity.availability === 'available'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : entity.availability === 'busy'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          entity.availability === 'available' ? 'bg-green-500' :
                          entity.availability === 'busy' ? 'bg-yellow-500' : 'bg-gray-500'
                        }`}></div>
                        <span className="capitalize">{entity.availability}</span>
                      </div>
                    </div>
                    <CardDescription className="text-base mb-2">{entity.title}</CardDescription>
                    <div className="flex items-center text-sm text-muted-foreground mb-2">
                      <MapPin className="w-4 h-4 mr-1" />
                      {entity.location}
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center">
                        <Star className="w-4 h-4 text-yellow-500 mr-1" />
                        {entity.rating} ({entity.reviews} reviews)
                      </div>
                      <div className="flex items-center">
                        <Briefcase className="w-4 h-4 mr-1" />
                        {entity.completedProjects} projects
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                  {entity.description}
                </p>

                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Specializations:</h4>
                  <div className="flex flex-wrap gap-1">
                    {entity.specializations.slice(0, 3).map((specialty) => (
                      <Badge key={specialty} variant="secondary" className="text-xs">
                        {specialty}
                      </Badge>
                    ))}
                    {entity.specializations.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{entity.specializations.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Skills:</h4>
                  <div className="flex flex-wrap gap-1">
                    {entity.skills.slice(0, 4).map((skill) => (
                      <Badge key={skill} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {entity.skills.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{entity.skills.length - 4} more
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <div>Member since {new Date(entity.memberSince).getFullYear()}</div>
                  <div>{entity.connections} connections</div>
                </div>

                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Users className="w-4 h-4 mr-1" />
                    Connect
                  </Button>
                  <Button size="sm" className="flex-1">
                    <MessageSquare className="w-4 h-4 mr-1" />
                    Message
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredEntities.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-muted-foreground mb-2">
              No entities found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Try adjusting your search criteria or check back later.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
