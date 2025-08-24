'use server'

import { redirect } from 'next/navigation'
import { getServerAuthSession } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { defaultLocale } from '@/i18n-config'
import { UserRole } from '@/features/auth/types'
import { apiClient, ApiClientError, type ApiResponse } from '@/lib/api-client'

export interface EntityFormState {
  success?: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
}

export async function createEntity(
  prevState: EntityFormState | null,
  formData: FormData
): Promise<EntityFormState> {
  const session = await getServerAuthSession()
  
  if (!session?.user?.id) {
    return {
      error: 'You must be logged in to create an entity'
    }
  }

  // Extract form data
  const name = formData.get('name') as string
  const type = formData.get('type') as string
  const shortDescription = formData.get('shortDescription') as string
  const fullDescription = formData.get('fullDescription') as string
  const entityLocation = formData.get('location') as string
  const website = formData.get('website') as string
  const contactEmail = formData.get('contactEmail') as string
  const isConfidential = formData.get('isConfidential') === 'true'
  const logoFile = formData.get('logo') as File
  const tagsString = formData.get('tags') as string

  // Validation
  const fieldErrors: Record<string, string> = {}
  
  if (!name?.trim()) {
    fieldErrors.name = 'Name is required'
  }
  
  if (!type) {
    fieldErrors.type = 'Type is required'
  }
  
  if (!shortDescription?.trim()) {
    fieldErrors.shortDescription = 'Short description is required'
  }
  
  if (!entityLocation?.trim()) {
    fieldErrors.location = 'Location is required'
  }
  
  if (website && !/^https?:\/\/.+/.test(website)) {
    fieldErrors.website = 'Website must be a valid URL'
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
    let logoUrl = ''
    
    // Handle file upload
    if (logoFile && logoFile.size > 0) {
      const uploadFormData = new FormData()
      uploadFormData.append('file', logoFile)
      
      // Use API client with optimized timeout for file uploads
      const uploadResponse: ApiResponse<{ url: string }> = await apiClient.post(`${process.env.NEXTAUTH_URL}/api/upload`, uploadFormData, {
        timeout: 30000, // 30 second timeout for file uploads
        retries: 2, // Retry twice for file uploads
        headers: {
          // Don't set Content-Type for FormData, let the browser set it
        }
      })
      
      if (uploadResponse.success && uploadResponse.data) {
        logoUrl = uploadResponse.data.url
      } else {
        return {
          error: uploadResponse.error || 'Failed to upload logo. Please try again.'
        }
      }
    }

    // Parse tags
    const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()).filter(Boolean) : []

    // Create entity data matching the Entity interface
    const entityData = {
      name: name.trim(),
      type: type as any, // Cast to EntityType
      shortDescription: shortDescription.trim(),
      fullDescription: fullDescription?.trim() || '',
      location: entityLocation.trim(),
      website: website?.trim() || '',
      contactEmail: contactEmail?.trim() || '',
      logo: logoUrl,
      tags: tags || [],
      isConfidential,
      addedBy: session.user.id,
      visibility: isConfidential ? 'confidential' as const : 'public' as const,
      opportunities: [],
      members: [session.user.id], // Add creator as first member
    }

    // Import and call the entity creation service
    const { createEntity: createEntityService } = await import('@/features/entities/services/create-entity')
    
    // Create the entity using the service
    const newEntity = await createEntityService(entityData)
    
    console.log('Entity created successfully:', { id: newEntity.id, name: newEntity.name })

    // Success - redirect to entities page
    redirect(ROUTES.ENTITIES(defaultLocale))
    
  } catch (error) {
    console.error('Error creating entity:', error)
    return {
      error: 'An unexpected error occurred. Please try again.'
    }
  }
}

/**
 * Role hierarchy for access control
 */
const ROLE_HIERARCHY = {
  [UserRole.VISITOR]: 0,
  [UserRole.SUBSCRIBER]: 1,
  [UserRole.MEMBER]: 2,
  [UserRole.CONFIDENTIAL]: 3,
  [UserRole.ADMIN]: 4,
} as const

export async function updateEntity(
  prevState: EntityFormState | null,
  formData: FormData
): Promise<EntityFormState> {
  const session = await getServerAuthSession()
  
  if (!session?.user?.id) {
    return { error: 'You must be logged in to update an entity' }
  }

  const userRole = (session.user as any)?.role as UserRole
  if (!userRole || ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[UserRole.MEMBER]) {
    return { error: 'Only MEMBER users and above can update entities' }
  }

  const entityId = formData.get('entityId') as string
  if (!entityId) {
    return { error: 'Entity ID is required' }
  }

  try {
    // Import and use the entity update service
    const { updateEntity: updateEntityService } = await import('@/features/entities/services/update-entity')
    const { getEntityById } = await import('@/features/entities/services/get-entity-by-id')
    
    // Check entity ownership or admin permissions
    const entity = await getEntityById(entityId)
    if (!entity) {
      return { error: 'Entity not found' }
    }

    const canUpdate = entity.addedBy === session.user.id || 
                     ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[UserRole.ADMIN]

    if (!canUpdate) {
      return { error: 'You do not have permission to update this entity' }
    }

    // Extract form data
    const name = formData.get('name') as string
    const type = formData.get('type') as string
    const shortDescription = formData.get('shortDescription') as string
    const fullDescription = formData.get('fullDescription') as string
    const entityLocation = formData.get('location') as string
    const website = formData.get('website') as string
    const contactEmail = formData.get('contactEmail') as string
    const isConfidential = formData.get('isConfidential') === 'true'
    const tagsString = formData.get('tags') as string

    // Validation
    const fieldErrors: Record<string, string> = {}
    
    if (!name?.trim()) {
      fieldErrors.name = 'Name is required'
    }
    
    if (!type) {
      fieldErrors.type = 'Type is required'
    }
    
    if (!shortDescription?.trim()) {
      fieldErrors.shortDescription = 'Short description is required'
    }
    
    if (!entityLocation?.trim()) {
      fieldErrors.location = 'Location is required'
    }
    
    if (website && !/^https?:\/\/.+/.test(website)) {
      fieldErrors.website = 'Website must be a valid URL'
    }
    
    if (contactEmail && !/\S+@\S+\.\S+/.test(contactEmail)) {
      fieldErrors.contactEmail = 'Please enter a valid email address'
    }

    if (Object.keys(fieldErrors).length > 0) {
      return { fieldErrors }
    }

    // Parse tags
    const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()).filter(Boolean) : []

    // Prepare update data
    const updateData = {
      name: name.trim(),
      type: type as any,
      shortDescription: shortDescription.trim(),
      fullDescription: fullDescription?.trim() || '',
      location: entityLocation.trim(),
      website: website?.trim() || '',
      contactEmail: contactEmail?.trim() || '',
      tags: tags || [],
      isConfidential,
      visibility: isConfidential ? 'confidential' as const : 'public' as const,
    }

    // Update the entity
    await updateEntityService(entityId, updateData)
    
    console.log('Entity updated successfully:', { id: entityId, name: updateData.name })

    // Redirect to entity status page
    redirect(ROUTES.ENTITY_STATUS('update', 'success', defaultLocale) + `?id=${entityId}`)
    
  } catch (error) {
    console.error('Error updating entity:', error)
    return {
      error: error instanceof Error ? error.message : 'Failed to update entity'
    }
  }
}

export async function deleteEntity(
  prevState: EntityFormState | null,
  formData: FormData
): Promise<EntityFormState> {
  const session = await getServerAuthSession()
  
  if (!session?.user?.id) {
    return { error: 'You must be logged in to delete an entity' }
  }

  const userRole = (session.user as any)?.role as UserRole
  if (!userRole || ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[UserRole.MEMBER]) {
    return { error: 'Only MEMBER users and above can delete entities' }
  }

  const entityId = formData.get('entityId') as string
  const confirmDelete = formData.get('confirmDelete') === 'true'
  
  if (!entityId) {
    return { error: 'Entity ID is required' }
  }

  if (!confirmDelete) {
    return { error: 'Delete confirmation is required' }
  }

  try {
    // Import and use the entity services
    const { deleteEntity: deleteEntityService } = await import('@/features/entities/services/delete-entity')
    const { getEntityById } = await import('@/features/entities/services/get-entity-by-id')
    
    // Check entity ownership or admin permissions
    const entity = await getEntityById(entityId)
    if (!entity) {
      return { error: 'Entity not found' }
    }

    const canDelete = entity.addedBy === session.user.id || 
                     ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[UserRole.ADMIN]

    if (!canDelete) {
      return { error: 'You do not have permission to delete this entity' }
    }

    // Delete the entity (soft delete in the service)
    await deleteEntityService(entityId)
    
    console.log('Entity deleted successfully:', { id: entityId })

    // Redirect to delete success status page
    redirect(ROUTES.ENTITY_STATUS('delete', 'success', defaultLocale) + `?id=${entityId}`)
    
  } catch (error) {
    console.error('Error deleting entity:', error)
    return {
      error: error instanceof Error ? error.message : 'Failed to delete entity'
    }
  }
}