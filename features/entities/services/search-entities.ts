// 🚀 OPTIMIZED SERVICE: Entity search with AI-powered matching and industry compatibility
// - Advanced text search with fuzzy matching
// - Industry and skill-based compatibility scoring
// - Intelligent search result ranking

import { Entity, SerializedEntity, EntityType } from '@/features/entities/types'
import { serializeEntities } from '@/lib/converters/entity-serializer'
import { UserRole } from '@/features/auth/types'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import { EntityAuthError, EntityQueryError, logRingError } from '@/lib/errors'
import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { getEntityTypeConfig } from '@/components/entities/entity-type-icons'
import { cache } from 'react'
/**
 * Entity search parameters interface
 */
export interface EntitySearchParams {
  query: string
  types?: EntityType[]
  location?: string
  maxResults?: number
  includeServices?: boolean
  includeIndustries?: boolean
  fuzzyMatch?: boolean
  userRole?: UserRole
}

/**
 * Entity search result with relevance scoring
 */
export interface EntitySearchResult {
  entity: Entity
  relevanceScore: number
  matchReasons: string[]
  industryCompatibility?: number
}

/**
 * Serialized entity search result for client compatibility
 */
export interface SerializedEntitySearchResult {
  entity: SerializedEntity
  relevanceScore: number
  matchReasons: string[]
  industryCompatibility?: number
}

/**
 * Search response interface
 */
export interface EntitySearchResponse {
  results: SerializedEntitySearchResult[]
  totalResults: number
  searchTime: number
  suggestions?: string[]
}

/**
 * Advanced entity search with AI-powered matching and industry compatibility.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and validates search parameters
 * 2. Builds optimized search query with role-based filtering
 * 3. Executes full-text search across multiple entity fields
 * 4. Applies fuzzy matching and relevance scoring
 * 5. Calculates industry compatibility scores
 * 6. Ranks results by relevance and compatibility
 * 7. Returns structured search results with metadata
 * 
 * Features:
 * - Multi-field text search (name, description, services, industries, tags)
 * - Fuzzy matching for typo tolerance
 * - Industry compatibility scoring
 * - Role-based result filtering
 * - Relevance-based ranking
 * - Search suggestions for improved UX
 * 
 * @param params - Search parameters object
 * @returns Promise<EntitySearchResponse> - Structured search results with metadata
 * @throws {EntityAuthError} If the user is not authenticated
 * @throws {EntityQueryError} If there's an error executing the search
 */
export const searchEntities = cache(async (params: EntitySearchParams): Promise<EntitySearchResponse> => {
  const startTime = Date.now()
  
  try {
    logger.info('Services: searchEntities - Starting search...', { 
      query: params.query, 
      types: params.types?.length,
      location: params.location 
    })

    // Step 1: Authenticate user if role not provided
    let userRole = params.userRole
    if (!userRole) {
      const session = await auth()
      if (!session || !session.user) {
        throw new EntityAuthError('Unauthorized access', undefined, {
          timestamp: Date.now(),
          hasSession: !!session,
          hasUser: !!session?.user,
          operation: 'searchEntities'
        })
      }
      userRole = session.user.role as UserRole
    }

    // Step 2: Validate search parameters
    if (!params.query || params.query.trim().length < 2) {
      return {
        results: [],
        totalResults: 0,
        searchTime: Date.now() - startTime,
        suggestions: ['Try searching for specific industry types', 'Use location-based search', 'Search for services or technologies']
      }
    }

    const maxResults = params.maxResults || 50
    const query = params.query.trim().toLowerCase()

    // Step 3: Initialize database
    await initializeDatabase()
    const db = getDatabaseService()

    // Build filters for role-based visibility
    const filters: any[] = []
    if (userRole === UserRole.VISITOR) {
      filters.push({ field: 'visibility', operator: '=', value: 'public' })
    } else if (userRole === UserRole.SUBSCRIBER) {
      // For subscriber, we need multiple queries or use JSONB contains
      // Simplified: fetch all and filter in-memory for now
    } else if (userRole === UserRole.MEMBER) {
      // Similar approach
    }

    // Apply type filtering if specified
    if (params.types && params.types.length === 1) {
      filters.push({ field: 'type', operator: '=', value: params.types[0] })
    }

    // Step 4: Execute base query
    const result = await db.query({
      collection: 'entities',
      filters,
      orderBy: [{ field: 'dateAdded', direction: 'desc' }],
      pagination: { limit: Math.min(maxResults * 2, 200) }
    })

    if (!result.success || !result.data) {
      logger.warn('EntitySearch: Query failed', { error: result.error })
      return {
        results: [],
        totalResults: 0,
        searchTime: Date.now() - startTime
      }
    }

    let entities = (Array.isArray(result.data) ? result.data : (result.data as any).data || []) as Entity[]

    // Apply in-memory filtering for complex visibility/type rules
    entities = entities.filter(entity => {
      // Visibility check
      if (userRole === UserRole.VISITOR && entity.visibility !== 'public') return false
      if (userRole === UserRole.SUBSCRIBER && !['public', 'subscriber'].includes(entity.visibility || 'public')) return false
      if (userRole === UserRole.MEMBER && !['public', 'subscriber', 'member'].includes(entity.visibility || 'public')) return false
      
      // Type check (if multiple types specified)
      if (params.types && params.types.length > 1 && !params.types.includes(entity.type)) return false
      
      return true
    })

    // Step 5: Apply advanced search filtering and scoring
    const searchResults: EntitySearchResult[] = []
    const queryTerms = query.split(/\s+/).filter(term => term.length > 1)

    for (const entity of entities) {
      const searchResult = calculateEntityRelevance(entity, query, queryTerms, params)
      
      if (searchResult.relevanceScore > 0) {
        searchResults.push(searchResult)
      }
    }

    // Step 6: Sort by relevance score and apply final limit
    searchResults.sort((a, b) => b.relevanceScore - a.relevanceScore)
    const finalResults = searchResults.slice(0, maxResults)

    // Step 7: Serialize entities for client compatibility
    const serializedResults: SerializedEntitySearchResult[] = finalResults.map(result => ({
      relevanceScore: result.relevanceScore,
      matchReasons: result.matchReasons,
      industryCompatibility: result.industryCompatibility,
      entity: serializeEntities([result.entity])[0]
    }))

    const searchTime = Date.now() - startTime
    
    logger.info('Services: searchEntities - Search completed:', {
      query: params.query,
      totalResults: serializedResults.length,
      searchTime,
      userRole
    })

    // Step 8: Generate search suggestions if results are limited
    const suggestions = generateSearchSuggestions(params.query, serializedResults.length, params.types)

    return {
      results: serializedResults,
      totalResults: serializedResults.length,
      searchTime,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    }

  } catch (error) {
    logRingError(error, 'Services: searchEntities - Error')
    
    if (error instanceof EntityAuthError) {
      throw error
    }
    
    throw new EntityQueryError(
      'Failed to execute entity search',
      error instanceof Error ? error : new Error(String(error)),
      {
        timestamp: Date.now(),
        query: params.query,
        operation: 'searchEntities'
      }
    )
  }
})

/**
 * Calculate entity relevance score based on search query and parameters
 */
function calculateEntityRelevance(
  entity: Entity, 
  query: string, 
  queryTerms: string[], 
  params: EntitySearchParams
): EntitySearchResult {
  let score = 0
  const matchReasons: string[] = []
  
  // Searchable text fields with different weights
  const searchFields = [
    { text: entity.name, weight: 10, field: 'name' },
    { text: entity.shortDescription, weight: 5, field: 'description' },
    { text: entity.fullDescription, weight: 3, field: 'fullDescription' },
    { text: entity.location, weight: 4, field: 'location' },
    { text: (entity.services || []).join(' '), weight: 6, field: 'services' },
    { text: (entity.industries || []).join(' '), weight: 7, field: 'industries' },
    { text: (entity.tags || []).join(' '), weight: 4, field: 'tags' }
  ]

  // Calculate text-based relevance
  for (const field of searchFields) {
    if (!field.text) continue
    
    const fieldText = field.text.toLowerCase()
    
    // Exact phrase match (highest score)
    if (fieldText.includes(query)) {
      score += field.weight * 3
      matchReasons.push(`Exact match in ${field.field}`)
    }
    
    // Individual term matches
    for (const term of queryTerms) {
      if (fieldText.includes(term)) {
        score += field.weight
        matchReasons.push(`Term "${term}" in ${field.field}`)
      }
      
      // Fuzzy matching for typos (if enabled)
      if (params.fuzzyMatch !== false) {
        const fuzzyScore = calculateFuzzyMatch(term, fieldText)
        if (fuzzyScore > 0.7) {
          score += field.weight * fuzzyScore * 0.5
          matchReasons.push(`Fuzzy match for "${term}" in ${field.field}`)
        }
      }
    }
  }

  // Location-based scoring
  if (params.location && entity.location) {
    const locationMatch = entity.location.toLowerCase().includes(params.location.toLowerCase())
    if (locationMatch) {
      score += 15
      matchReasons.push('Location match')
    }
  }

  // Industry compatibility scoring
  let industryCompatibility = 0
  if (params.includeIndustries !== false) {
    industryCompatibility = calculateIndustryCompatibility(entity, query, queryTerms)
    score += industryCompatibility * 2
    
    if (industryCompatibility > 0.5) {
      matchReasons.push('High industry compatibility')
    }
  }

  // Boost verified entities
  if (entity.certifications && entity.certifications.length > 0) {
    score *= 1.2
    matchReasons.push('Verified entity')
  }

  // Boost entities with partnerships
  if (entity.partnerships && entity.partnerships.length > 0) {
    score *= 1.1
    matchReasons.push('Has partnerships')
  }

  return {
    entity: entity as any, // Will be serialized later
    relevanceScore: Math.round(score * 100) / 100,
    matchReasons: matchReasons.slice(0, 3), // Limit to top 3 reasons
    industryCompatibility: Math.round(industryCompatibility * 100) / 100
  }
}

/**
 * Calculate fuzzy match score using simple string similarity
 */
function calculateFuzzyMatch(term: string, text: string): number {
  if (term.length < 3) return 0
  
  // Simple fuzzy matching - can be enhanced with more sophisticated algorithms
  const words = text.split(/\s+/)
  let bestMatch = 0
  
  for (const word of words) {
    if (word.length < 3) continue
    
    const similarity = calculateStringSimilarity(term, word)
    bestMatch = Math.max(bestMatch, similarity)
  }
  
  return bestMatch
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length
  
  if (len1 === 0) return len2 === 0 ? 1 : 0
  if (len2 === 0) return 0
  
  const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null))
  
  for (let i = 0; i <= len1; i++) matrix[0][i] = i
  for (let j = 0; j <= len2; j++) matrix[j][0] = j
  
  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1,     // deletion
        matrix[j][i - 1] + 1,     // insertion
        matrix[j - 1][i - 1] + cost // substitution
      )
    }
  }
  
  const distance = matrix[len2][len1]
  const maxLen = Math.max(len1, len2)
  return (maxLen - distance) / maxLen
}

/**
 * Calculate industry compatibility score based on entity type and services
 */
function calculateIndustryCompatibility(entity: Entity, query: string, queryTerms: string[]): number {
  let compatibility = 0
  
  // Get entity type configuration for industry matching
  const typeConfig = getEntityTypeConfig(entity.type)
  const typeKeywords = [
    typeConfig.label.toLowerCase(),
    typeConfig.description.toLowerCase(),
    entity.type.toLowerCase()
  ]
  
  // Check if query relates to entity's industry
  for (const term of queryTerms) {
    for (const keyword of typeKeywords) {
      if (keyword.includes(term) || term.includes(keyword.split(' ')[0])) {
        compatibility += 0.3
      }
    }
  }
  
  // Check services compatibility
  if (entity.services) {
    for (const service of entity.services) {
      const serviceText = service.toLowerCase()
      for (const term of queryTerms) {
        if (serviceText.includes(term)) {
          compatibility += 0.2
        }
      }
    }
  }
  
  return Math.min(compatibility, 1.0)
}

/**
 * Generate search suggestions based on query and results
 */
function generateSearchSuggestions(query: string, resultCount: number, types?: EntityType[]): string[] {
  const suggestions: string[] = []
  
  if (resultCount === 0) {
    suggestions.push('Try broader search terms')
    suggestions.push('Check spelling of search terms')
    
    if (!types || types.length === 0) {
      suggestions.push('Filter by specific industry types')
    }
    
    suggestions.push('Search for location-based entities')
    suggestions.push('Try searching for services or technologies')
  } else if (resultCount < 5) {
    suggestions.push('Try broader search terms for more results')
    
    if (types && types.length > 0) {
      suggestions.push('Remove industry filters for more results')
    }
  }
  
  return suggestions.slice(0, 3) // Limit to 3 suggestions
}

/**
 * Get search suggestions based on popular entity types and services
 */
export const getEntitySearchSuggestions = cache(async (
  partialQuery: string,
  userRole?: UserRole
): Promise<string[]> => {
  try {
    // This could be enhanced with actual analytics data
    const popularSearches = [
      'software development',
      'manufacturing',
      'biotechnology',
      'AI machine learning',
      'cybersecurity',
      'clean energy',
      'robotics',
      'blockchain',
      '3D printing',
      'IoT development'
    ]
    
    const query = partialQuery.toLowerCase()
    const suggestions = popularSearches.filter(search => 
      search.toLowerCase().includes(query) && search !== query
    )
    
    return suggestions.slice(0, 5)
    
  } catch (error) {
    logger.warn('Failed to get search suggestions:', error)
    return []
  }
})
