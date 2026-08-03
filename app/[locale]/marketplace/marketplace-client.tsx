'use client'

import React, { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import MarketplaceWrapper from '@/components/wrappers/marketplace-wrapper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar } from '@/components/ui/avatar'
import {
  Store,
  Search,
  Star,
  MessageSquare,
  Clock,
  Users,
  CheckCircle,
  Award,
  TrendingUp,
  Briefcase,
  Rocket,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DavinciGlassChip,
  DavinciGlassStatBlock,
  davinciBeamInnerSurface,
  davinciCtaPrimary,
  davinciGlassSurface,
} from '@/lib/ui/davinci'

const INSET = 'px-4 sm:px-5 lg:px-6'
const BAND_Y = 'py-12 sm:py-14 lg:py-16'

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
    description:
      'Expert in Ring platform customization and white-label implementations. 5+ years experience with React/Next.js and blockchain integration.',
    responseTime: '< 2 hours',
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
    description:
      'Certified Ring platform consultant specializing in enterprise deployments and security hardening.',
    responseTime: '< 1 hour',
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
    description:
      'Specialized in Web3 integrations for Ring platform including NFT marketplaces and DeFi functionality.',
    responseTime: '< 3 hours',
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
    description:
      'Creative UI/UX designer focused on Ring platform branding and user experience optimization.',
    responseTime: '< 4 hours',
  },
]

const mockServices: Service[] = [
  {
    id: '1',
    title: 'Complete Ring Platform Setup',
    description:
      'Full Ring platform deployment with custom configuration, branding, and initial setup.',
    category: 'Platform Setup',
    price: '$2500',
    deliveryTime: '5-7 days',
    vendor: mockVendors[0],
    rating: 4.9,
    reviews: 23,
    featured: true,
    tags: ['Setup', 'Configuration', 'Deployment'],
  },
  {
    id: '2',
    title: 'Ring Web3 Integration',
    description:
      'Integrate Web3 wallet functionality, NFT marketplace, and blockchain features.',
    category: 'Web3 Integration',
    price: '$1800',
    deliveryTime: '7-10 days',
    vendor: mockVendors[2],
    rating: 4.8,
    reviews: 18,
    featured: true,
    tags: ['Web3', 'NFT', 'Blockchain'],
  },
  {
    id: '3',
    title: 'Ring Security Audit',
    description:
      'Comprehensive security assessment and hardening for Ring platform deployments.',
    category: 'Security',
    price: '$3200',
    deliveryTime: '10-14 days',
    vendor: mockVendors[1],
    rating: 5.0,
    reviews: 31,
    featured: false,
    tags: ['Security', 'Audit', 'Hardening'],
  },
]

function isVendor(item: Vendor | Service): item is Vendor {
  return 'skills' in item && 'specialties' in item && 'hourlyRate' in item
}

function isService(item: Vendor | Service): item is Service {
  return 'vendor' in item && 'price' in item && 'deliveryTime' in item
}

function parseHourlyRate(rate: string): number {
  return Number.parseInt(rate.replace(/[^0-9]/g, ''), 10) || 0
}

function parsePrice(price: string): number {
  return Number.parseInt(price.replace(/[^0-9]/g, ''), 10) || 0
}

export default function MarketplaceClient() {
  const t = useTranslations('pages.marketplace')
  const tVendor = useTranslations('vendor')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')
  const [sortBy, setSortBy] = useState('rating')
  const [viewMode, setViewMode] = useState<'vendors' | 'services'>('vendors')

  const availableVendors = mockVendors.filter((v) => v.available).length
  const featuredVendors = mockVendors.filter((v) => v.featured).length

  const filteredItems = useMemo(() => {
    const source: Array<Vendor | Service> =
      viewMode === 'vendors' ? mockVendors : mockServices

    return source
      .filter((item) => {
        const searchableText =
          viewMode === 'vendors' && isVendor(item)
            ? `${item.name} ${item.title} ${item.skills.join(' ')} ${item.specialties.join(' ')}`
            : isService(item)
              ? `${item.title} ${item.description} ${item.tags.join(' ')} ${item.vendor.name}`
              : ''

        const matchesSearch = searchableText
          .toLowerCase()
          .includes(searchQuery.toLowerCase())

        let matchesCategory = true
        if (viewMode === 'services' && categoryFilter !== 'all' && isService(item)) {
          matchesCategory = item.category === categoryFilter
        }

        let matchesAvailability = true
        if (viewMode === 'vendors' && availabilityFilter !== 'all' && isVendor(item)) {
          matchesAvailability = item.available === (availabilityFilter === 'available')
        }

        return matchesSearch && matchesCategory && matchesAvailability
      })
      .sort((a, b) => {
        if (viewMode === 'vendors' && isVendor(a) && isVendor(b)) {
          switch (sortBy) {
            case 'rating':
              return b.rating - a.rating
            case 'reviews':
              return b.reviews - a.reviews
            case 'rate':
              return parseHourlyRate(b.hourlyRate) - parseHourlyRate(a.hourlyRate)
            default:
              return 0
          }
        }
        if (viewMode === 'services' && isService(a) && isService(b)) {
          switch (sortBy) {
            case 'rating':
              return b.rating - a.rating
            case 'price':
              return parsePrice(b.price) - parsePrice(a.price)
            default:
              return 0
          }
        }
        return 0
      })
  }, [viewMode, searchQuery, categoryFilter, availabilityFilter, sortBy])

  return (
    <MarketplaceWrapper>
      <div className="w-full min-w-0">
        {/* Hero — full-bleed */}
        <section className={cn('relative overflow-hidden text-center', BAND_Y)}>
          <div
            className="pointer-events-none absolute inset-0 bg-[color-mix(in_oklch,var(--davinci-beam)_8%,transparent)]"
            aria-hidden
          />
          <div className={cn('relative mx-auto max-w-4xl space-y-6', INSET)}>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              {t('title')}
            </h1>
            <p className="mx-auto max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t('subtitle')}
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <DavinciGlassChip icon={<Users className="h-3 w-3" />}>
                {t('tabs.vendors')}
              </DavinciGlassChip>
              <DavinciGlassChip icon={<Briefcase className="h-3 w-3" />}>
                {t('tabs.services')}
              </DavinciGlassChip>
              <DavinciGlassChip icon={<Store className="h-3 w-3" />}>
                {tVendor('becomeVendor')}
              </DavinciGlassChip>
            </div>
          </div>
        </section>

        {/* Snapshot stats — derived from catalog, not invented KPIs */}
        <section
          className={cn(
            BAND_Y,
            'bg-[color-mix(in_oklch,var(--davinci-glass-bg)_80%,hsl(var(--muted)))]',
          )}
        >
          <div className={cn('mx-auto grid max-w-5xl grid-cols-2 gap-3 lg:grid-cols-4', INSET)}>
            <DavinciGlassStatBlock
              value={String(mockVendors.length)}
              label={t('tabs.vendors')}
              beamOnHover={false}
            />
            <DavinciGlassStatBlock
              value={String(mockServices.length)}
              label={t('tabs.services')}
              beamOnHover={false}
            />
            <DavinciGlassStatBlock
              value={String(availableVendors)}
              label={t('search.availableNow')}
              beamOnHover={false}
            />
            <DavinciGlassStatBlock
              value={String(featuredVendors)}
              label={t('vendor.featured')}
              beamOnHover={false}
            />
          </div>
        </section>

        {/* Controls — inset */}
        <section className={cn('pb-8 pt-10', INSET)}>
          <div className="mx-auto max-w-5xl space-y-4">
            <div className={cn(davinciGlassSurface, 'mx-auto flex w-fit gap-1 p-1')}>
              <button
                type="button"
                onClick={() => setViewMode('vendors')}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  viewMode === 'vendors'
                    ? 'bg-[color-mix(in_oklch,var(--davinci-beam)_18%,transparent)] text-foreground'
                    : 'text-muted-foreground hover:bg-white/5',
                )}
              >
                {t('tabs.vendors')} ({mockVendors.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('services')}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  viewMode === 'services'
                    ? 'bg-[color-mix(in_oklch,var(--davinci-beam)_18%,transparent)] text-foreground'
                    : 'text-muted-foreground hover:bg-white/5',
                )}
              >
                {t('tabs.services')} ({mockServices.length})
              </button>
            </div>

            <div className={cn(davinciGlassSurface, davinciBeamInnerSurface, 'p-4')}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
                <div className="lg:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={`${t('search.placeholder')} ${viewMode}…`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {viewMode === 'services' ? (
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('search.allCategories')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('search.allCategories')}</SelectItem>
                      <SelectItem value="Platform Setup">{t('categories.platformSetup')}</SelectItem>
                      <SelectItem value="Web3 Integration">
                        {t('categories.web3Integration')}
                      </SelectItem>
                      <SelectItem value="Security">{t('categories.security')}</SelectItem>
                      <SelectItem value="UI/UX">{t('categories.uiUx')}</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('search.allAvailability')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('search.allAvailability')}</SelectItem>
                      <SelectItem value="available">{t('search.availableNow')}</SelectItem>
                      <SelectItem value="busy">{t('search.currentlyBusy')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('search.sortBy')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rating">{t('search.highestRated')}</SelectItem>
                    {viewMode === 'vendors' ? (
                      <>
                        <SelectItem value="reviews">{t('search.mostReviews')}</SelectItem>
                        <SelectItem value="rate">{t('search.hourlyRate')}</SelectItem>
                      </>
                    ) : (
                      <SelectItem value="price">{t('search.price')}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </section>

        {/* Results */}
        <section className={cn('pb-4', INSET)}>
          <div className="mx-auto max-w-5xl">
            {filteredItems.length === 0 ? (
              <div className={cn(davinciGlassSurface, 'px-6 py-12 text-center')}>
                <Store className="mx-auto mb-4 h-12 w-12 text-[var(--davinci-beam)] opacity-60" />
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  {t('empty.title', { type: viewMode })}
                </h3>
                <p className="text-sm text-muted-foreground">{t('empty.description')}</p>
              </div>
            ) : viewMode === 'vendors' ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {filteredItems.map((item) => {
                  if (!isVendor(item)) return null
                  const vendor = item
                  return (
                    <article
                      key={vendor.id}
                      className={cn(
                        davinciGlassSurface,
                        'relative min-w-0 p-4 sm:p-5',
                        vendor.featured &&
                          'border-[color-mix(in_oklch,var(--davinci-beam)_45%,transparent)]',
                      )}
                    >
                      {vendor.featured ? (
                        <div className="absolute right-3 top-3 z-10">
                          <DavinciGlassChip icon={<Award className="h-3 w-3" />}>
                            {t('vendor.featured')}
                          </DavinciGlassChip>
                        </div>
                      ) : null}

                      <div className="flex items-start gap-3 pr-16">
                        <Avatar
                          src={vendor.avatar}
                          alt={vendor.name}
                          fallback={vendor.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                          size="lg"
                          className="shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                            <h2 className="text-lg font-semibold tracking-tight text-foreground">
                              {vendor.name}
                            </h2>
                            {vendor.verified ? (
                              <CheckCircle
                                className="h-4 w-4 text-[var(--davinci-beam)]"
                                aria-label={t('vendor.verified')}
                              />
                            ) : null}
                            {!vendor.available ? (
                              <DavinciGlassChip>{t('vendor.busy')}</DavinciGlassChip>
                            ) : null}
                          </div>
                          <p className="mb-2 text-sm text-muted-foreground">{vendor.title}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 text-[var(--davinci-beam)]" />
                              {vendor.rating} ({vendor.reviews})
                            </span>
                            <span className="font-medium tabular-nums text-[var(--davinci-beam)]">
                              {vendor.hourlyRate}
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                        {vendor.description}
                      </p>

                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-semibold text-foreground">
                          {t('vendor.specialties')}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {vendor.specialties.slice(0, 3).map((specialty) => (
                            <DavinciGlassChip key={specialty}>{specialty}</DavinciGlassChip>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-semibold text-foreground">{t('vendor.skills')}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {vendor.skills.slice(0, 4).map((skill) => (
                            <span
                              key={skill}
                              className="rounded-md border border-[color-mix(in_oklch,var(--davinci-beam)_20%,transparent)] px-2 py-0.5 text-[11px] text-muted-foreground"
                            >
                              {skill}
                            </span>
                          ))}
                          {vendor.skills.length > 4 ? (
                            <span className="px-1 text-[11px] text-muted-foreground">
                              +{vendor.skills.length - 4} {t('vendor.more')}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {vendor.completedProjects} {t('vendor.projects')}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {vendor.responseTime}
                        </span>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1">
                          <MessageSquare className="mr-1 h-4 w-4" />
                          {t('vendor.message')}
                        </Button>
                        <Button
                          size="sm"
                          className={cn('flex-1', vendor.available && davinciCtaPrimary)}
                          disabled={!vendor.available}
                        >
                          {vendor.available ? t('vendor.hireNow') : t('vendor.unavailable')}
                        </Button>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {filteredItems.map((item) => {
                  if (!isService(item)) return null
                  const service = item
                  return (
                    <article
                      key={service.id}
                      className={cn(
                        davinciGlassSurface,
                        'relative min-w-0 p-4 sm:p-5',
                        service.featured &&
                          'border-[color-mix(in_oklch,var(--davinci-beam)_45%,transparent)]',
                      )}
                    >
                      {service.featured ? (
                        <div className="absolute right-3 top-3 z-10">
                          <DavinciGlassChip icon={<TrendingUp className="h-3 w-3" />}>
                            {t('service.featured')}
                          </DavinciGlassChip>
                        </div>
                      ) : null}

                      <h2 className="pr-20 text-lg font-semibold tracking-tight text-foreground">
                        {service.title}
                      </h2>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {service.description}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <DavinciGlassChip>{service.category}</DavinciGlassChip>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Star className="h-3.5 w-3.5 text-[var(--davinci-beam)]" />
                          {service.rating} ({service.reviews})
                        </span>
                      </div>

                      <div className="mt-4 flex items-end justify-between gap-3">
                        <div className="text-2xl font-bold tabular-nums text-[var(--davinci-beam)]">
                          {service.price}
                        </div>
                        <div className="text-xs text-muted-foreground">{service.deliveryTime}</div>
                      </div>

                      <div
                        className={cn(
                          davinciBeamInnerSurface,
                          'mt-4 flex items-center gap-3 p-3',
                        )}
                      >
                        <Avatar
                          src={service.vendor.avatar}
                          alt={service.vendor.name}
                          fallback={service.vendor.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{service.vendor.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {service.vendor.title}
                          </div>
                        </div>
                        {service.vendor.verified ? (
                          <CheckCircle className="h-4 w-4 shrink-0 text-[var(--davinci-beam)]" />
                        ) : null}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {service.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md border border-[color-mix(in_oklch,var(--davinci-beam)_20%,transparent)] px-2 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <Button className={cn('mt-4 w-full', davinciCtaPrimary)}>
                        {t('service.orderService')}
                      </Button>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* Closing CTA — inset interactions, full-bleed band */}
        <section
          className={cn(
            BAND_Y,
            'bg-[color-mix(in_oklch,var(--davinci-glass-bg)_80%,hsl(var(--muted)))]',
          )}
        >
          <div className={cn('mx-auto max-w-2xl text-center', INSET)}>
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{tVendor('becomeVendor')}</h2>
            <p className="mb-8 text-base text-muted-foreground sm:text-lg">{t('subtitle')}</p>
            <Link
              href={{ pathname: '/membership' }}
              className={cn(
                davinciCtaPrimary,
                'inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold sm:text-base',
              )}
            >
              <Rocket className="size-4 shrink-0 text-[var(--davinci-beam)]" aria-hidden />
              {tVendor('becomeVendor')}
            </Link>
          </div>
        </section>
      </div>
    </MarketplaceWrapper>
  )
}
