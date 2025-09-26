'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Store,
  Search,
  Star,
  MessageSquare,
  DollarSign,
  Clock,
  Users,
  CheckCircle,
  Award,
  TrendingUp,
  Filter
} from 'lucide-react'

interface Vendor {
  id: string
  name: string
  avatar: string
  title: string
  rating: number
  reviews: number
  completedProjects: number
  hourlyRate: string
  location: string
  skills: string[]
  specialties: string[]
  verified: boolean
  featured: boolean
  available: boolean
  description: string
  responseTime: string
}

interface Service {
  id: string
  title: string
  description: string
  category: string
  price: string
  deliveryTime: string
  vendor: Vendor
  rating: number
  reviews: number
  featured: boolean
  tags: string[]
}

const mockVendors: Vendor[] = [
  {
    id: '1',
    name: 'Alex Chen',
    avatar: '/avatars/alex.jpg',
    title: 'Full-Stack Ring Developer',
    rating: 4.9,
    reviews: 127,
    completedProjects: 89,
    hourlyRate: '$85/hour',
    location: 'San Francisco, CA',
    skills: ['React', 'Next.js', 'Firebase', 'Web3', 'TypeScript'],
    specialties: ['Ring Customization', 'White-label Implementation', 'Web3 Integration'],
    verified: true,
    featured: true,
    available: true,
    description: 'Expert in Ring platform customization and white-label implementations. 5+ years experience with React/Next.js and blockchain integration.',
    responseTime: '< 2 hours'
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    avatar: '/avatars/sarah.jpg',
    title: 'Ring Platform Consultant',
    rating: 5.0,
    reviews: 93,
    completedProjects: 67,
    hourlyRate: '$120/hour',
    location: 'London, UK',
    skills: ['System Architecture', 'DevOps', 'Security', 'Project Management'],
    specialties: ['Ring Architecture', 'Security Audits', 'Performance Optimization'],
    verified: true,
    featured: true,
    available: true,
    description: 'Certified Ring platform consultant specializing in enterprise deployments and security hardening.',
    responseTime: '< 1 hour'
  },
  {
    id: '3',
    name: 'Marcus Rodriguez',
    avatar: '/avatars/marcus.jpg',
    title: 'Web3 & NFT Specialist',
    rating: 4.8,
    reviews: 156,
    completedProjects: 112,
    hourlyRate: '$95/hour',
    location: 'Berlin, Germany',
    skills: ['Solidity', 'Web3.js', 'NFT', 'DeFi', 'Smart Contracts'],
    specialties: ['NFT Marketplaces', 'DeFi Integration', 'Token Economics'],
    verified: true,
    featured: false,
    available: true,
    description: 'Specialized in Web3 integrations for Ring platform including NFT marketplaces and DeFi functionality.',
    responseTime: '< 3 hours'
  },
  {
    id: '4',
    name: 'Emily Davis',
    avatar: '/avatars/emily.jpg',
    title: 'UI/UX Ring Specialist',
    rating: 4.7,
    reviews: 78,
    completedProjects: 54,
    hourlyRate: '$75/hour',
    location: 'Toronto, Canada',
    skills: ['UI/UX Design', 'Figma', 'React', 'Tailwind CSS', 'Design Systems'],
    specialties: ['Ring UI Customization', 'Brand Integration', 'User Experience'],
    verified: true,
    featured: false,
    available: false,
    description: 'Creative UI/UX designer focused on Ring platform branding and user experience optimization.',
    responseTime: '< 4 hours'
  }
]

const mockServices: Service[] = [
  {
    id: '1',
    title: 'Complete Ring Platform Setup',
    description: 'Full Ring platform deployment with custom configuration, branding, and initial setup.',
    category: 'Platform Setup',
    price: '$2500',
    deliveryTime: '5-7 days',
    vendor: mockVendors[0],
    rating: 4.9,
    reviews: 23,
    featured: true,
    tags: ['Setup', 'Configuration', 'Deployment']
  },
  {
    id: '2',
    title: 'Ring Web3 Integration',
    description: 'Integrate Web3 wallet functionality, NFT marketplace, and blockchain features.',
    category: 'Web3 Integration',
    price: '$1800',
    deliveryTime: '7-10 days',
    vendor: mockVendors[2],
    rating: 4.8,
    reviews: 18,
    featured: true,
    tags: ['Web3', 'NFT', 'Blockchain']
  },
  {
    id: '3',
    title: 'Ring Security Audit',
    description: 'Comprehensive security assessment and hardening for Ring platform deployments.',
    category: 'Security',
    price: '$3200',
    deliveryTime: '10-14 days',
    vendor: mockVendors[1],
    rating: 5.0,
    reviews: 31,
    featured: false,
    tags: ['Security', 'Audit', 'Hardening']
  }
]

export default function MVMarketplacePage() {
  const [vendors, setVendors] = useState<Vendor[]>(mockVendors)
  const [services, setServices] = useState<Service[]>(mockServices)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('rating')
  const [viewMode, setViewMode] = useState<'vendors' | 'services'>('vendors')

  // Type guard functions
  const isVendor = (item: Vendor | Service): item is Vendor => {
    return 'skills' in item && 'specialties' in item && 'hourlyRate' in item
  }

  const isService = (item: Vendor | Service): item is Service => {
    return 'vendor' in item && 'price' in item && 'deliveryTime' in item
  }

  const filteredItems = (viewMode === 'vendors' ? vendors : services).filter((item) => {
    const searchableText = viewMode === 'vendors'
      ? `${(item as Vendor).name} ${(item as Vendor).title} ${(item as Vendor).skills?.join(' ') || ''} ${(item as Vendor).specialties?.join(' ') || ''}`
      : `${(item as Service).title} ${(item as Service).description} ${(item as Service).tags?.join(' ') || ''} ${(item as Service).vendor?.name || ''}`

    const matchesSearch = searchableText.toLowerCase().includes(searchQuery.toLowerCase())

    let matchesCategory = true
    if (viewMode === 'services' && categoryFilter !== 'all' && isService(item)) {
      matchesCategory = item.category === categoryFilter
    }

    let matchesAvailability = true
    if (viewMode === 'vendors' && availabilityFilter !== 'all' && isVendor(item)) {
      matchesAvailability = item.available === (availabilityFilter === 'available')
    }

    return matchesSearch && matchesCategory && matchesAvailability
  }).sort((a, b) => {
    if (viewMode === 'vendors' && isVendor(a) && isVendor(b)) {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating
        case 'reviews':
          return b.reviews - a.reviews
        case 'rate':
          return parseInt(b.hourlyRate.replace('$', '').replace('/hour', '')) -
                 parseInt(a.hourlyRate.replace('$', '').replace('/hour', ''))
        default:
          return 0
      }
    } else if (viewMode === 'services' && isService(a) && isService(b)) {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating
        case 'price':
          return parseInt(b.price.replace('$', '')) - parseInt(a.price.replace('$', ''))
        default:
          return 0
      }
    }
    return 0
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Store className="w-8 h-8 text-green-600 mr-3" />
            <h1 className="text-4xl font-bold">MV Marketplace</h1>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Marketplace for Ring-powered site development and services. Become a MEMBER-level vendor and offer your expertise.
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-1 shadow-md">
            <button
              onClick={() => setViewMode('vendors')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                viewMode === 'vendors'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Browse Vendors ({vendors.length})
            </button>
            <button
              onClick={() => setViewMode('services')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                viewMode === 'services'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Service Packages ({services.length})
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder={`Search ${viewMode}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {viewMode === 'services' && (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Platform Setup">Platform Setup</SelectItem>
                  <SelectItem value="Web3 Integration">Web3 Integration</SelectItem>
                  <SelectItem value="Security">Security</SelectItem>
                  <SelectItem value="UI/UX">UI/UX</SelectItem>
                </SelectContent>
              </Select>
            )}

            {viewMode === 'vendors' && (
              <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Availability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Availability</SelectItem>
                  <SelectItem value="available">Available Now</SelectItem>
                  <SelectItem value="busy">Currently Busy</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rating">Highest Rated</SelectItem>
                {viewMode === 'vendors' && (
                  <>
                    <SelectItem value="reviews">Most Reviews</SelectItem>
                    <SelectItem value="rate">Hourly Rate</SelectItem>
                  </>
                )}
                {viewMode === 'services' && (
                  <SelectItem value="price">Price</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results */}
        {viewMode === 'vendors' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredItems.map((vendor: Vendor) => (
              <Card key={vendor.id} className={`relative ${vendor.featured ? 'ring-2 ring-green-500' : ''}`}>
                {vendor.featured && (
                  <div className="absolute top-4 right-4 z-10">
                    <Badge className="bg-green-600 text-white">
                      <Award className="w-3 h-3 mr-1" />
                      Featured
                    </Badge>
                  </div>
                )}

                <CardHeader>
                  <div className="flex items-start space-x-4">
                    <Avatar
                      src={vendor.avatar}
                      alt={vendor.name}
                      fallback={vendor.name.split(' ').map(n => n[0]).join('')}
                      className="w-16 h-16"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <CardTitle className="text-xl">{vendor.name}</CardTitle>
                        {vendor.verified && (
                          <CheckCircle className="w-5 h-5 text-blue-600" />
                        )}
                        {!vendor.available && (
                          <Badge variant="outline" className="text-orange-600 border-orange-200">
                            Busy
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-base mb-2">{vendor.title}</CardDescription>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300">
                        <div className="flex items-center">
                          <Star className="w-4 h-4 text-yellow-500 mr-1" />
                          {vendor.rating} ({vendor.reviews} reviews)
                        </div>
                        <div className="flex items-center">
                          <DollarSign className="w-4 h-4 mr-1" />
                          {vendor.hourlyRate}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">
                    {vendor.description}
                  </p>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">Specialties:</h4>
                    <div className="flex flex-wrap gap-1">
                      {vendor.specialties.slice(0, 3).map((specialty) => (
                        <Badge key={specialty} variant="secondary" className="text-xs">
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">Skills:</h4>
                    <div className="flex flex-wrap gap-1">
                      {vendor.skills.slice(0, 4).map((skill) => (
                        <Badge key={skill} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {vendor.skills.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{vendor.skills.length - 4} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-1" />
                      {vendor.completedProjects} projects
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {vendor.responseTime}
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Message
                    </Button>
                    <Button size="sm" className="flex-1" disabled={!vendor.available}>
                      {vendor.available ? 'Hire Now' : 'Unavailable'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredItems.map((service: Service) => (
              <Card key={service.id} className={`relative ${service.featured ? 'ring-2 ring-green-500' : ''}`}>
                {service.featured && (
                  <div className="absolute top-4 right-4 z-10">
                    <Badge className="bg-green-600 text-white">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Featured
                    </Badge>
                  </div>
                )}

                <CardHeader>
                  <CardTitle className="text-xl">{service.title}</CardTitle>
                  <CardDescription className="line-clamp-2">{service.description}</CardDescription>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge variant="outline">{service.category}</Badge>
                    <div className="flex items-center text-sm">
                      <Star className="w-4 h-4 text-yellow-500 mr-1" />
                      {service.rating} ({service.reviews})
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-2xl font-bold text-green-600">{service.price}</div>
                    <div className="text-sm text-gray-500">{service.deliveryTime}</div>
                  </div>

                  <div className="flex items-center space-x-3 mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <Avatar
                      src={service.vendor.avatar}
                      alt={service.vendor.name}
                      fallback={service.vendor.name.split(' ').map(n => n[0]).join('')}
                      className="w-10 h-10"
                    />
                    <div>
                      <div className="font-semibold text-sm">{service.vendor.name}</div>
                      <div className="text-xs text-gray-500">{service.vendor.title}</div>
                    </div>
                    {service.vendor.verified && (
                      <CheckCircle className="w-4 h-4 text-blue-600" />
                    )}
                  </div>

                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {service.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    Order Service
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <Store className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">
              No {viewMode} found
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
