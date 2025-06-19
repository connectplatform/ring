'use server'

import { redirect } from 'next/navigation'
import { getServerAuthSession } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { defaultLocale } from '@/utils/i18n-server'

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

  // Extract form data
  const title = formData.get('title') as string
  const type = formData.get('type') as string // 'offer' or 'request'
  const category = formData.get('category') as string
  const description = formData.get('description') as string
  const requirements = formData.get('requirements') as string
  const budget = formData.get('budget') as string
  const deadline = formData.get('deadline') as string
  const contactEmail = formData.get('contactEmail') as string
  const entityId = formData.get('entityId') as string
  const isConfidential = formData.get('isConfidential') === 'true'
  const tagsString = formData.get('tags') as string

  // Validation
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
  
  if (!entityId?.trim()) {
    fieldErrors.entityId = 'Entity is required'
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

    // Create opportunity data
    const opportunityData = {
      title: title.trim(),
      type,
      category: category.trim(),
      description: description.trim(),
      requirements: requirements?.trim() || '',
      budget: budget?.trim() || '',
      deadline: deadline || '',
      contactEmail: contactEmail?.trim() || '',
      entityId: entityId.trim(),
      tags,
      isConfidential,
      addedBy: session.user.id,
    }

    // For now, log the data instead of submitting to API
    console.log('Opportunity data to be saved:', opportunityData)
    
    // Success - redirect to opportunities page
    redirect(ROUTES.OPPORTUNITIES(defaultLocale))
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