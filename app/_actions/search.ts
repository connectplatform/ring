'use server'

import { getServerAuthSession } from '@/auth'

export interface SearchFormState {
  success?: boolean
  message?: string
  error?: string
  results?: SearchResult[]
  query?: string
  category?: string
}

export interface SearchResult {
  id: string
  title: string
  description: string
  type: 'entity' | 'opportunity'
  category?: string
  location?: string
  createdAt: string
  url?: string
}

export async function searchEntities(
  prevState: SearchFormState | null,
  formData: FormData
): Promise<SearchFormState> {
  // Optional: Get session for personalized search results
  const session = await getServerAuthSession()
  const userRole = (session?.user as any)?.role
  
  const query = formData.get('query') as string
  const category = formData.get('category') as string || 'all'

  // Validation
  if (!query?.trim()) {
    return {
      error: 'Search query is required'
    }
  }

  if (query.trim().length < 2) {
    return {
      error: 'Search query must be at least 2 characters'
    }
  }

  try {
    // Mock search results for demonstration
    const mockResults: SearchResult[] = [
      {
        id: '1',
        title: `Tech startup matching "${query}"`,
        description: 'Innovative technology company focused on AI solutions',
        type: 'entity' as const,
        category: 'Technology',
        location: 'Cherkasy',
        createdAt: new Date().toISOString(),
        url: '/entities/1'
      },
      {
        id: '2',
        title: `Looking for ${query} developers`,
        description: 'We need experienced developers for our growing team',
        type: 'opportunity' as const,
        category: 'Employment',
        location: 'Remote',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        url: '/opportunities/2'
      }
    ].filter(result => {
      if (category === 'all') return true
      if (category === 'entities' && result.type === 'entity') return true
      if (category === 'opportunities' && result.type === 'opportunity') return true
      return false
    })

    return {
      success: true,
      results: mockResults,
      query: query.trim(),
      category,
      message: `Found ${mockResults.length} result${mockResults.length === 1 ? '' : 's'}`
    }

  } catch (error: any) {
    console.error('Search error:', error)
    return {
      error: 'Search failed. Please try again.'
    }
  }
} 