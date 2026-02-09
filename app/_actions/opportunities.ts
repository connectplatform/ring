'use server'

import { redirect } from 'next/navigation'
import { auth } from '@/auth'
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
  redirectUrl?: string
}

export async function createOpportunity(
  prevState: OpportunityFormState | null,
  formData: FormData
): Promise<OpportunityFormState> {

  const session = await auth()
  
  if (!session?.user?.id) {
    return {
      error: 'You must be logged in to create an opportunity'
    }
  }

  const userRole = (session.user as any)?.role as UserRole
  
  // Extract form data
  const title = formData.get('title') as string
  const type = formData.get('type') as 'offer' | 'request' | 'partnership' | 'volunteer' | 'mentorship' | 'resource' | 'event' | 'ring_customization'
  const category = formData.get('category') as string
  const description = formData.get('description') as string
  const requirements = formData.get('requirements') as string
  
  // Extract budget fields (separate fields in form)
  const budgetMin = formData.get('budgetMin') as string
  const budgetMax = formData.get('budgetMax') as string
  const budgetCurrency = formData.get('budgetCurrency') as string
  
  const deadline = formData.get('deadline') as string
  const applicationDeadline = formData.get('applicationDeadline') as string
  const maxApplicants = formData.get('maxApplicants') as string
  const priority = formData.get('priority') as 'urgent' | 'normal' | 'low'
  const contactEmail = formData.get('contactEmail') as string
  let entityId = formData.get('entityId') as string
  const isConfidential = formData.get('isConfidential') === 'true'
  const tagsString = formData.get('tags') as string
  const requiredSkillsString = formData.get('requiredSkills') as string

  // Role-based validation
  if (!userRole || ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[UserRole.SUBSCRIBER]) {
    return { error: 'Only SUBSCRIBER users and above can create opportunities' }
  }

  // Type-specific validation based on the enhanced type system
  const requestTypes = ['request', 'ring_customization'];
  const organizationalTypes = ['offer', 'partnership', 'volunteer', 'mentorship', 'resource', 'event'];
  
  if (requestTypes.includes(type)) {
    // Requests can be created by SUBSCRIBER+, no entity required
    if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[UserRole.SUBSCRIBER]) {
      return { 
        error: 'Only SUBSCRIBER users and above can create requests' 
      }
    }
    // For requests, we set organizationId to null to indicate it's from an individual
    entityId = null
  } else if (organizationalTypes.includes(type)) {
    // Organizational opportunities require MEMBER role and entity
    if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[UserRole.MEMBER]) {
      return { 
        error: `Only MEMBER users and above can create ${type} opportunities. Upgrade your membership to create organizational opportunities.` 
      }
    }
    
    if (!entityId?.trim()) {
      return { error: `Entity is required for ${type} opportunities` }
    }
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
    // Parse tags and required skills
    const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()).filter(Boolean) : []
    const requiredSkills = requiredSkillsString ? requiredSkillsString.split(',').map(skill => skill.trim()).filter(Boolean) : []

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

    // Parse deadlines - convert to Timestamp for Firestore compatibility
    const { Timestamp } = await import('firebase-admin/firestore')
    const deadlineDate = deadline ? new Date(deadline) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Default 30 days
    const expirationDate = Timestamp.fromDate(deadlineDate)
    
    // Parse application deadline if provided
    let applicationDeadlineTimestamp = undefined
    if (applicationDeadline?.trim()) {
      try {
        applicationDeadlineTimestamp = Timestamp.fromDate(new Date(applicationDeadline))
      } catch (e) {
        console.warn('Could not parse application deadline:', applicationDeadline)
      }
    }

    // Parse max applicants
    let maxApplicantsNumber = undefined
    if (maxApplicants?.trim()) {
      try {
        maxApplicantsNumber = parseInt(maxApplicants)
      } catch (e) {
        console.warn('Could not parse max applicants:', maxApplicants)
      }
    }

    // Create opportunity data matching the Opportunity interface
    const opportunityData = {
      type,
      title: title.trim(),
      isConfidential,
      briefDescription: description.trim(),
      fullDescription: description?.trim() || '',
      createdBy: session.user.id,
      // For requests: null (individual), for organizational types: entityId (organization)
      organizationId: requestTypes.includes(type) ? null : entityId?.trim() || null,
      expirationDate,
      ...(applicationDeadlineTimestamp ? { applicationDeadline: applicationDeadlineTimestamp } : {}),
      status: 'active' as const,
      category: category.trim(),
      tags,
      location: formData.get('location')?.toString().trim() || '',
      ...(budgetObj ? { budget: budgetObj } : {}), // Only include budget if defined
      requiredSkills,
      requiredDocuments: [],
      attachments: [],
      applicantCount: 0, // Initialize with 0 applicants
      ...(maxApplicantsNumber ? { maxApplicants: maxApplicantsNumber } : {}),
      ...(priority ? { priority } : {}),
      visibility: isConfidential ? 'confidential' as const : 'public' as const,
      contactInfo: {
        linkedEntity: requestTypes.includes(type) ? '' : entityId?.trim() || '',
        contactAccount: contactEmail?.trim() || session.user.email || ''
      },
      isPrivate: requestTypes.includes(type) // Requests are private (individual), organizational types are not
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
    
    // Return success with redirect URL instead of using redirect()
    // This follows React 19/Next.js 15 patterns for server actions
    return {
      success: true,
      message: 'Opportunity created successfully!',
      redirectUrl: `/${defaultLocale}/opportunities/status/create/success?id=${newOpportunity.id}&type=${type}&opportunityTitle=${encodeURIComponent(title)}`
    }
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

  const session = await auth()
  
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

  const userRole = (session.user as any)?.role as UserRole
  const userId = session.user.id

  try {
    // First, fetch the existing opportunity to check ownership and permissions
    const { getOpportunityById } = await import('@/features/opportunities/services/get-opportunity-by-id')
    const existingOpportunity = await getOpportunityById(opportunityId)
    
    if (!existingOpportunity) {
      return {
        error: 'Opportunity not found'
      }
    }

    // Check ownership and permissions
    const isOwner = existingOpportunity.createdBy === userId
    const isAdmin = userRole === UserRole.ADMIN
    const isConfidentialUser = userRole === UserRole.CONFIDENTIAL
    
    if (!isOwner && !isAdmin && !isConfidentialUser) {
      return {
        error: 'You do not have permission to update this opportunity'
      }
    }

    // Extract form data
    const title = formData.get('title') as string
    const type = formData.get('type') as string
    const category = formData.get('category') as string
    const description = formData.get('description') as string
    const requirements = formData.get('requirements') as string
    
    // Extract budget fields (separate fields in form)
    const budgetMin = formData.get('budgetMin') as string
    const budgetMax = formData.get('budgetMax') as string
    const budgetCurrency = formData.get('budgetCurrency') as string
    
    const deadline = formData.get('deadline') as string
    const applicationDeadline = formData.get('applicationDeadline') as string
    const maxApplicants = formData.get('maxApplicants') as string
    const priority = formData.get('priority') as 'urgent' | 'normal' | 'low'
    const contactEmail = formData.get('contactEmail') as string
    const entityId = formData.get('entityId') as string
    const isConfidential = formData.get('isConfidential') === 'true'
    const tagsString = formData.get('tags') as string
    const requiredSkillsString = formData.get('requiredSkills') as string
    const status = formData.get('status') as 'active' | 'closed' | 'expired'
    const visibility = formData.get('visibility') as 'public' | 'subscriber' | 'member' | 'confidential'

    // Validation
    const fieldErrors: Record<string, string> = {}
    
    if (!title?.trim()) {
      fieldErrors.title = 'Title is required'
    }
    
    if (!type || !['offer', 'request', 'partnership', 'volunteer', 'mentorship', 'resource', 'event', 'ring_customization'].includes(type)) {
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
    
    if (deadline && new Date(deadline) <= new Date()) {
      fieldErrors.deadline = 'Deadline must be in the future'
    }

    // Role-based validation for confidential opportunities
    if (isConfidential && !isAdmin && !isConfidentialUser) {
      fieldErrors.isConfidential = 'Only ADMIN or CONFIDENTIAL users can create confidential opportunities'
    }

    if (Object.keys(fieldErrors).length > 0) {
      return {
        fieldErrors
      }
    }

    // Parse tags and required skills
    const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()).filter(Boolean) : []
    const requiredSkills = requiredSkillsString ? requiredSkillsString.split(',').map(skill => skill.trim()).filter(Boolean) : []

    // Parse budget from separate form fields
    let budgetObj = undefined
    if (budgetMin?.trim() || budgetMax?.trim()) {
      try {
        const min = budgetMin?.trim() ? parseInt(budgetMin) : undefined
        const max = budgetMax?.trim() ? parseInt(budgetMax) : undefined
        const currency = budgetCurrency?.trim() || 'USD'
        
        if (min !== undefined || max !== undefined) {
          budgetObj = {
            min: min || max || 0,
            max: max || min || 0,
            currency
          }
        }
      } catch (e) {
        console.warn('Could not parse budget from form fields:', { budgetMin, budgetMax, budgetCurrency })
      }
    }

    // Parse deadlines - convert to Timestamp for Firestore compatibility
    const { Timestamp } = await import('firebase-admin/firestore')
    let expirationDate = existingOpportunity.expirationDate
    if (deadline?.trim()) {
      try {
        expirationDate = Timestamp.fromDate(new Date(deadline))
      } catch (e) {
        console.warn('Could not parse deadline:', deadline)
      }
    }
    
    // Parse application deadline if provided
    let applicationDeadlineTimestamp = existingOpportunity.applicationDeadline
    if (applicationDeadline?.trim()) {
      try {
        applicationDeadlineTimestamp = Timestamp.fromDate(new Date(applicationDeadline))
      } catch (e) {
        console.warn('Could not parse application deadline:', applicationDeadline)
      }
    }

    // Parse max applicants
    let maxApplicantsNumber = existingOpportunity.maxApplicants
    if (maxApplicants?.trim()) {
      try {
        maxApplicantsNumber = parseInt(maxApplicants)
      } catch (e) {
        console.warn('Could not parse max applicants:', maxApplicants)
      }
    }

    // Create update data
    const updateData: any = {
      title: title.trim(),
      type,
      category: category.trim(),
      briefDescription: description.trim(),
      fullDescription: description?.trim() || '',
      tags,
      requiredSkills,
      location: formData.get('location')?.toString().trim() || existingOpportunity.location || '',
      isConfidential,
      visibility: isConfidential ? 'confidential' : (visibility || 'public'),
      contactInfo: {
        linkedEntity: entityId?.trim() || existingOpportunity.contactInfo?.linkedEntity || '',
        contactAccount: contactEmail?.trim() || session.user.email || existingOpportunity.contactInfo?.contactAccount || ''
      },
      dateUpdated: Timestamp.now()
    }

    // Add optional fields if provided
    if (budgetObj) {
      updateData.budget = budgetObj
    }
    
    if (expirationDate) {
      updateData.expirationDate = expirationDate
    }
    
    if (applicationDeadlineTimestamp) {
      updateData.applicationDeadline = applicationDeadlineTimestamp
    }
    
    if (maxApplicantsNumber !== undefined) {
      updateData.maxApplicants = maxApplicantsNumber
    }
    
    if (priority) {
      updateData.priority = priority
    }
    
    if (status) {
      updateData.status = status
    }

    // Import and call the opportunity update service
    const { updateOpportunity: updateOpportunityService } = await import('@/features/opportunities/services/update-opportunity')
    
    // Update the opportunity using the service
    const updatedOpportunity = await updateOpportunityService(opportunityId, updateData)
    
    console.log('Opportunity updated successfully:', { 
      id: updatedOpportunity.id, 
      title: updatedOpportunity.title, 
      type: updatedOpportunity.type 
    })
    
    // Return success with redirect URL
    return {
      success: true,
      message: 'Opportunity updated successfully!',
      redirectUrl: `/${defaultLocale}/opportunities/status/update/success?id=${updatedOpportunity.id}&type=${type}&opportunityTitle=${encodeURIComponent(title)}`
    }
    
  } catch (error) {
    console.error('Error updating opportunity:', error)
    return {
      error: 'An unexpected error occurred. Please try again.'
    }
  }
}

export async function deleteOpportunity(
  prevState: OpportunityFormState | null,
  formData: FormData
): Promise<OpportunityFormState> {

  const session = await auth()
  
  if (!session?.user?.id) {
    return {
      error: 'You must be logged in to delete an opportunity'
    }
  }

  const opportunityId = formData.get('opportunityId') as string
  
  if (!opportunityId) {
    return {
      error: 'Opportunity ID is required'
    }
  }

  const userRole = (session.user as any)?.role as UserRole
  const userId = session.user.id

  try {
    // First, fetch the existing opportunity to check ownership and permissions
    const { getOpportunityById } = await import('@/features/opportunities/services/get-opportunity-by-id')
    const existingOpportunity = await getOpportunityById(opportunityId)
    
    if (!existingOpportunity) {
      return {
        error: 'Opportunity not found'
      }
    }

    // Check ownership and permissions
    const isOwner = existingOpportunity.createdBy === userId
    const isAdmin = userRole === UserRole.ADMIN
    const isConfidentialUser = userRole === UserRole.CONFIDENTIAL
    
    if (!isOwner && !isAdmin && !isConfidentialUser) {
      return {
        error: 'You do not have permission to delete this opportunity'
      }
    }

    // Import and call the opportunity deletion service
    const { deleteOpportunity: deleteOpportunityService } = await import('@/features/opportunities/services/delete-opportunity')
    
    // Perform soft delete with ownership checks
    await deleteOpportunityService(opportunityId, userId, userRole)
    
    console.log('Opportunity deleted successfully:', { 
      id: opportunityId, 
      title: existingOpportunity.title, 
      deletedBy: userId 
    })
    
    // Return success with redirect URL
    return {
      success: true,
      message: 'Opportunity deleted successfully!',
      redirectUrl: `/${defaultLocale}/opportunities/status/delete/success?id=${opportunityId}&opportunityTitle=${encodeURIComponent(existingOpportunity.title)}`
    }
    
  } catch (error) {
    console.error('Error deleting opportunity:', error)
    return {
      error: 'An unexpected error occurred. Please try again.'
    }
  }
} 