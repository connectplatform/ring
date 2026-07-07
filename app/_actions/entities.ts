'use server'

// Native Next.js 16/React 19 server actions and form handling support are used here.
// TODO: Consider using React 19's useFormStatus and useOptimistic for enhanced UX in forms and error handling, where client side is involved.

import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { UserRolesArray } from '@/features/auth/user-role'
import {
  hasRoleAtLeast,
  isPlatformAdmin,
  assertKnownUserRole,
} from '@/features/auth/user-role'
import { canCreateEntity } from '@/features/entities/lib/entity-permissions'
import { updateEntity as updateEntityService } from '@/features/entities/services/update-entity'
import { executeUnifiedUpload } from '@/lib/uploads/server/upload-core'

export interface EntityFormState {
  success?: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
}

// Creates a new entity, handling file (logo) upload and permissions checking.
export async function createEntity(
  prevState: EntityFormState | null,
  formData: FormData,
  locale: Locale
): Promise<EntityFormState> {
  // Authenticate current user session
  const session = await auth()

  // If user is not logged in, return error immediately.
  if (!session?.user?.id) {
    return {
      error: 'You must be logged in to create an entity',
    }
  }

  // Ensure userRole is valid and known.
  const userRole = assertKnownUserRole(session.user.role)
  // Determine if the entity to be created is confidential.
  const wantsConfidential = formData.get('isConfidential') === 'true'
  // Permission check based on role and confidentiality need.
  if (!canCreateEntity(userRole, { isConfidential: wantsConfidential })) {
    return {
      error: wantsConfidential
        ? 'Only confidential or admin users can create confidential entities'
        : 'Only member, confidential, or admin users can create entities',
    }
  }

  // --- Extract and normalize form data fields ---
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

  // --- Server-side validation of input data ---
  const fieldErrors: Record<string, string> = {}

  // Minimal name required.
  if (!name?.trim()) {
    fieldErrors.name = 'Name is required'
  }
  // Type selection required.
  if (!type) {
    fieldErrors.type = 'Type is required'
  }
  // Short description is mandatory.
  if (!shortDescription?.trim()) {
    fieldErrors.shortDescription = 'Short description is required'
  }
  // Location is required.
  if (!entityLocation?.trim()) {
    fieldErrors.location = 'Location is required'
  }
  // URL validation for website if present.
  if (website && !/^https?:\/\/.+/.test(website)) {
    fieldErrors.website = 'Website must be a valid URL'
  }
  // Basic email format validation if present.
  if (contactEmail && !/\S+@\S+\.\S+/.test(contactEmail)) {
    fieldErrors.contactEmail = 'Please enter a valid email address'
  }

  // If there are any validation errors, return them for form feedback.
  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
    }
  }

  try {
    // Parse tag list into array, trimming whitespace and removing empty entries.
    const tags = tagsString
      ? tagsString.split(',').map(tag => tag.trim()).filter(Boolean)
      : []

    // Prepare the entity object conforming to expected server Entity interface.
    const entityData = {
      locale: session.user.settings.language,
      name: name.trim(),
      type: type as any, // Cast to EntityType (Could be improved with zod or more strict TS generics)
      shortDescription: shortDescription.trim(),
      fullDescription: fullDescription?.trim() || '',
      location: entityLocation.trim(),
      website: website?.trim() || '',
      contactEmail: contactEmail?.trim() || '',
      logo: '', // Logo handled after record creation
      tags: tags || [],
      isConfidential,
      addedBy: session.user.id,
      visibility: isConfidential ? 'confidential' as const : 'public' as const,
      opportunities: [],
      members: [session.user.id], // Creator as initial member
    }

    // Dynamically import the creation service for this method (SSR optimization).
    const { createEntity: createEntityService } = await import(
      '@/features/entities/services/create-entity'
    )

    // Call the service to create the entity.
    const newEntity = await createEntityService(entityData)

    // If a logo file was uploaded, handle the upload and attach logo URL.
    if (logoFile && logoFile.size > 0) {
      const uploadResult = await executeUnifiedUpload({
        file: logoFile,
        meta: {
          purpose: 'entity:logo',
          scope: {
            entityId: newEntity.id,
          },
          fileName: logoFile.name,
        },
      })

      if (uploadResult.success === false) {
        // On upload error, inform user.
        return {
          error: uploadResult.error || 'Failed to upload logo. Please try again.',
        }
      }

      // Attach uploaded logo URL onto entity via update service.
      await updateEntityService(newEntity.id, {
        logo: uploadResult.url,
      })
    }

    // Logging for monitoring or audit.
    console.log('Entity created successfully:', {
      id: newEntity.id,
      name: newEntity.name,
    })

    // On success, redirect user to main entities list.
    // TODO: With React 19's startTransition/useOptimistic, we could potentially optimistically update client UI.
    redirect(ROUTES.ENTITIES(locale))
  } catch (error) {
    // On error, log and return generic error message for security.
    console.error('Error creating entity:', error)
    return {
      error: 'An unexpected error occurred. Please try again.',
    }
  }
}

// Updates selected entity with editable fields and after permission check.
// Supports update by owner or admin.
export async function updateEntity(
  prevState: EntityFormState | null,
  formData: FormData,
  locale: Locale
): Promise<EntityFormState> {
  // Authenticate user session for server action.
  const session = await auth()

  // Early out if not authenticated
  if (!session?.user?.id) {
    return { error: 'You must be logged in to update an entity' }
  }

  // Get and check permissions (must be at least member level)
  const userRole = (session.user as any)?.role as UserRolesArray
  if (!hasRoleAtLeast(userRole, UserRolesArray.member)) {
    return { error: 'Only MEMBER users and above can update entities' }
  }

  // --- Required field: Which entity to update? ---
  const entityId = formData.get('entityId') as string
  if (!entityId) {
    return { error: 'Entity ID is required' }
  }

  try {
    // Import dynamic services to avoid unnecessary module load on other server actions
    const { updateEntity: updateEntityService } = await import(
      '@/features/entities/services/update-entity'
    )
    const { getEntityById } = await import(
      '@/features/entities/services/get-entity-by-id'
    )

    // Retrieve entity, check for existence.
    const entity = await getEntityById(entityId)
    if (!entity) {
      return { error: 'Entity not found' }
    }

    // Only owner or platform admins can update.
    const canUpdate =
      entity.addedBy === session.user.id || isPlatformAdmin(userRole)

    if (!canUpdate) {
      return { error: 'You do not have permission to update this entity' }
    }

    // --- Extract form fields to update ---
    const name = formData.get('name') as string
    const type = formData.get('type') as string
    const shortDescription = formData.get('shortDescription') as string
    const fullDescription = formData.get('fullDescription') as string
    const entityLocation = formData.get('location') as string
    const website = formData.get('website') as string
    const contactEmail = formData.get('contactEmail') as string
    const isConfidential = formData.get('isConfidential') === 'true'
    const tagsString = formData.get('tags') as string

    // --- Server-side validation as in creation ---
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

    // --- Extract and process tags field ---
    const tags = tagsString
      ? tagsString.split(',').map(tag => tag.trim()).filter(Boolean)
      : []

    // --- Prepare the update payload for fields which can be edited ---
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

    // --- Perform update in DB/service layer. ---
    await updateEntityService(entityId, updateData)

    // Logging for devops/monitoring
    console.log('Entity updated successfully:', { id: entityId, name: updateData.name })

    // Redirect to entity update status page
    redirect(
      ROUTES.ENTITY_STATUS('update', 'success', locale) + `?id=${entityId}`
    )
  } catch (error) {
    // Error handling for unexpected errors, forwarding error message if available.
    console.error('Error updating entity:', error)
    return {
      error: error instanceof Error ? error.message : 'Failed to update entity',
    }
  }
}

// Handles soft or hard deletion of an entity, permission checked.
// Note that actual deletion logic handled in service layer; this just orchestrates.
export async function deleteEntity(
  prevState: EntityFormState | null,
  formData: FormData,
  locale: Locale
): Promise<EntityFormState> {
  // Authenticate the user session
  const session = await auth()

  // Only logged in users can delete entities.
  if (!session?.user?.id) {
    return { error: 'You must be logged in to delete an entity' }
  }

  // Only member or above can delete entities.
  const userRole = assertKnownUserRole((session.user as any)?.role as UserRolesArray)
  if (!hasRoleAtLeast(userRole, UserRolesArray.member)) {
    return { error: 'Only MEMBER users and above can delete entities' }
  }

  // Get which entity to delete and ensure user followed confirmation protocol.
  const entityId = formData.get('entityId') as string
  const confirmDelete = formData.get('confirmDelete') === 'true'

  if (!entityId) {
    return { error: 'Entity ID is required' }
  }

  if (!confirmDelete) {
    return { error: 'Delete confirmation is required' }
  }

  try {
    // Dynamically import to not load dependency if not deleting
    const { deleteEntity: deleteEntityService } = await import(
      '@/features/entities/services/delete-entity'
    )
    const { getEntityById } = await import(
      '@/features/entities/services/get-entity-by-id'
    )

    // Confirm entity exists to avoid deleting non-existent resources.
    const entity = await getEntityById(entityId)
    if (!entity) {
      return { error: 'Entity not found' }
    }

    // Only owner or platform admin may delete.
    const canDelete = entity.addedBy === session.user.id || isPlatformAdmin(userRole)

    if (!canDelete) {
      return { error: 'You do not have permission to delete this entity' }
    }

    // Call deletion routine (soft delete preferred in most cases).
    await deleteEntityService(entityId)

    // Log for auditing/removal notifications.
    console.log('Entity deleted successfully:', { id: entityId })

    // Redirect to status page on completion.
    redirect(
      ROUTES.ENTITY_STATUS('delete', 'success', locale) + `?id=${entityId}`
    )
  } catch (error) {
    // Wrap and forward service layer errors for user visibility.
    console.error('Error deleting entity:', error)
    return {
      error:
        error instanceof Error ? error.message : 'Failed to delete entity',
    }
  }
}