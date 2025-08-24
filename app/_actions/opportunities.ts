'use server'

import { redirect } from 'next/navigation'
import { getServerAuthSession } from '@/auth'
import { UserRole } from '@/features/auth/types'

// Role hierarchy for access control
const ROLE_HIERARCHY = {
  [UserRole.VISITOR]: 0,
  [UserRole.SUBSCRIBER]: 1,
  [UserRole.MEMBER]: 2,
  [UserRole.CONFIDENTIAL]: 3,
  [UserRole.ADMIN]: 4,
} as const
import { ROUTES } from '@/constants/routes'
import { defaultLocale } from '@/i18n-config'

export interface OpportunityFormState {
  success?: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
}

export async function createOpportunity(
  prevState: OpportunityFormState | null,
  formData: FormData
): Promise<OpportunityFormState> {
  const session = await getServerAuthSession()
  
  if (!session?.user?.id) {
    return {
      error: 'You must be logged in to create an opportunity'
    }
  }

  const userRole = (session.user as any)?.role as UserRole
  
  // Extract form data
  const title = formData.get('title') as string
  const type = formData.get('type') as 'offer' | 'request'
  const category = formData.get('category') as string
  const description = formData.get('description') as string
  const requirements = formData.get('requirements') as string
  
  // Extract budget fields (separate fields in form)
  const budgetMin = formData.get('budgetMin') as string
  const budgetMax = formData.get('budgetMax') as string
  const budgetCurrency = formData.get('budgetCurrency') as string
  
  const deadline = formData.get('deadline') as string
  const contactEmail = formData.get('contactEmail') as string
  let entityId = formData.get('entityId') as string
  const isConfidential = formData.get('isConfidential') === 'true'
  const tagsString = formData.get('tags') as string

  // Role-based validation
  if (!userRole || ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[UserRole.SUBSCRIBER]) {
    return { error: 'Only SUBSCRIBER users and above can create opportunities' }
  }

  // Type-specific validation
  if (type === 'offer') {
    // Offers require MEMBER role and entity
    if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[UserRole.MEMBER]) {
      return { 
        error: 'Only MEMBER users and above can create offers. Upgrade your membership to create offers.' 
      }
    }
    
    if (!entityId?.trim()) {
      return { error: 'Entity is required for offers' }
    }
  } else if (type === 'request') {
    // Requests can be created by SUBSCRIBER+, no entity required
    if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[UserRole.SUBSCRIBER]) {
      return { 
        error: 'Only SUBSCRIBER users and above can create requests' 
      }
    }
    // For requests, we set organizationId to null to indicate it's from an individual
    entityId = null
  } else {
    return { error: 'Valid opportunity type is required' }
  }

  // Validation
  const fieldErrors: Record<string, string> = {}
  
  if (!title?.trim()) {
    fieldErrors.title = 'Title is required'
  }
  
  if (!category?.trim()) {
    fieldErrors.category = 'Category is required'
  }
  
  if (!description?.trim()) {
    fieldErrors.description = 'Description is required'
  }
  
  // Entity validation only for offers
  if (type === 'offer' && !entityId?.trim()) {
    fieldErrors.entityId = 'Entity is required for offers'
  }
  
  if (contactEmail && !/\S+@\S+\.\S+/.test(contactEmail)) {
    fieldErrors.contactEmail = 'Please enter a valid email address'
  }
  
  if (deadline && new Date(deadline) <= new Date()) {
    fieldErrors.deadline = 'Deadline must be in the future'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors
    }
  }

  try {
    // Parse tags
    const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()).filter(Boolean) : []

    // Parse budget from separate form fields
    let budgetObj = undefined
    if (budgetMin?.trim() || budgetMax?.trim()) {
      try {
        const min = budgetMin?.trim() ? parseInt(budgetMin) : undefined
        const max = budgetMax?.trim() ? parseInt(budgetMax) : undefined
        const currency = budgetCurrency?.trim() || 'USD'
        
        // Only create budget object if we have at least min or max
        if (min !== undefined || max !== undefined) {
          budgetObj = {
            min: min || max || 0, // Use max if min is not provided, or 0 as fallback
            max: max || min || 0, // Use min if max is not provided, or 0 as fallback
            currency
          }
        }
      } catch (e) {
        console.warn('Could not parse budget from form fields:', { budgetMin, budgetMax, budgetCurrency })
      }
    }

    // Parse deadline to expiration date - convert to Timestamp for Firestore compatibility
    const { Timestamp } = await import('firebase-admin/firestore')
    const deadlineDate = deadline ? new Date(deadline) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Default 30 days
    const expirationDate = Timestamp.fromDate(deadlineDate)

    // Create opportunity data matching the Opportunity interface
    // Only include budget if it's defined to prevent Firestore undefined errors
    const opportunityData = {
      type: type as 'offer' | 'request',
      title: title.trim(),
      isConfidential,
      briefDescription: description.trim(),
      fullDescription: requirements?.trim() || '',
      createdBy: session.user.id,
      // For requests: null (individual), for offers: entityId (organization)
      organizationId: type === 'request' ? null : entityId?.trim() || null,
      expirationDate,
      status: 'active' as const,
      category: category.trim(),
      tags,
      location: formData.get('location')?.toString().trim() || '',
      ...(budgetObj ? { budget: budgetObj } : {}), // Only include budget if defined
      requiredSkills: requirements ? requirements.split(',').map(s => s.trim()).filter(Boolean) : [],
      requiredDocuments: [],
      attachments: [],
      visibility: isConfidential ? 'confidential' as const : 'public' as const,
      contactInfo: {
        linkedEntity: type === 'request' ? '' : entityId?.trim() || '',
        contactAccount: contactEmail?.trim() || session.user.email || ''
      }
    }

    // Import and call the opportunity creation service
    const { createOpportunity: createOpportunityService } = await import('@/features/opportunities/services/create-opportunity')
    
    // Create the opportunity using the service
    const newOpportunity = await createOpportunityService(opportunityData)
    
    console.log('Opportunity created successfully:', { 
      id: newOpportunity.id, 
      title: newOpportunity.title, 
      type: newOpportunity.type,
      organizationId: newOpportunity.organizationId 
    })
    
    // Redirect to success status page
    redirect(`/${defaultLocale}/opportunities/status/create/success?id=${newOpportunity.id}&type=${type}`)
  } catch (error) {
    console.error('Error creating opportunity:', error)
    return {
      error: 'An unexpected error occurred. Please try again.'
    }
  }
}

export async function updateOpportunity(
  prevState: OpportunityFormState | null,
  formData: FormData
): Promise<OpportunityFormState> {
  const session = await getServerAuthSession()
  
  if (!session?.user?.id) {
    return {
      error: 'You must be logged in to update an opportunity'
    }
  }

  const opportunityId = formData.get('opportunityId') as string
  
  if (!opportunityId) {
    return {
      error: 'Opportunity ID is required'
    }
  }

  // Extract form data (same as create but with ID)
  const title = formData.get('title') as string
  const type = formData.get('type') as string
  const category = formData.get('category') as string
  const description = formData.get('description') as string
  const requirements = formData.get('requirements') as string
  const budget = formData.get('budget') as string
  const deadline = formData.get('deadline') as string
  const contactEmail = formData.get('contactEmail') as string
  const isConfidential = formData.get('isConfidential') === 'true'
  const tagsString = formData.get('tags') as string

  // Validation (same as create)
  const fieldErrors: Record<string, string> = {}
  
  if (!title?.trim()) {
    fieldErrors.title = 'Title is required'
  }
  
  if (!type || !['offer', 'request'].includes(type)) {
    fieldErrors.type = 'Valid type is required'
  }
  
  if (!category?.trim()) {
    fieldErrors.category = 'Category is required'
  }
  
  if (!description?.trim()) {
    fieldErrors.description = 'Description is required'
  }
  
  if (contactEmail && !/\S+@\S+\.\S+/.test(contactEmail)) {
    fieldErrors.contactEmail = 'Please enter a valid email address'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors
    }
  }

  try {
    const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()).filter(Boolean) : []

    const opportunityData = {
      title: title.trim(),
      type,
      category: category.trim(),
      description: description.trim(),
      requirements: requirements?.trim() || '',
      budget: budget?.trim() || '',
      deadline: deadline || '',
      contactEmail: contactEmail?.trim() || '',
      tags,
      isConfidential,
    }

    // For now, log the data instead of submitting to API
    console.log('Opportunity data to be saved:', opportunityData)

    return {
      success: true,
      message: 'Opportunity updated successfully!'
    }
    
  } catch (error) {
    console.error('Error updating opportunity:', error)
    return {
      error: 'An unexpected error occurred. Please try again.'
    }
  }
} 