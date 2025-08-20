'use server'

import { redirect } from 'next/navigation'
import { getServerAuthSession } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { defaultLocale } from '@/i18n-config'

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
      
      const uploadResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/upload`, {
        method: 'POST',
        body: uploadFormData,
      })
      
      if (!uploadResponse.ok) {
        return {
          error: 'Failed to upload logo. Please try again.'
        }
      }
      
      const result = await uploadResponse.json()
      logoUrl = result.url
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