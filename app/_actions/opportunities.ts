'use server'

// Imports (authentication, user roles, and permissions utilities)
// TODO: Switch to `useSession`, `useUser` React hooks in client-side components where possible for cleaner logic separation.
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import {
  assertKnownUserRole,
  hasRoleAtLeast,
  isPlatformAdmin,
} from '@/features/auth/user-role'
import { UserRolesArray } from '@/features/auth/user-role'
import {
  canCreateOpportunityType,
  canCreateOpportunityConfidential,
  canEditOpportunity,
  canDeleteOpportunity,
  assertOpportunityVisibilityPatch,
} from '@/features/opportunities/lib/opportunity-permissions'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

// State definition for Opportunity-related form actions
export interface OpportunityFormState {
  success?: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
  redirectUrl?: string
}

/**
 * Server action to create a new opportunity.
 * Handles validation, permission checks, business rules for type, confidentiality, and entity linkage.
 * Returns proper outcome for client-side action reducers/handlers.
 * @param prevState Previous form state (unused here, but maintained for Server Actions signature)
 * @param formData Next.js FormData from client POST
 * @param locale   Active locale string
 * @returns Outcome object with error, fieldErrors, or redirectUrl
 */
export async function createOpportunity(
  prevState: OpportunityFormState | null,
  formData: FormData,
  locale: Locale
): Promise<OpportunityFormState> {

  // Get the current session and confirm authentication
  const session = await auth()
  if (!session?.user?.id) {
    // User must be authenticated to continue
    return {
      error: 'You must be logged in to create an opportunity'
    }
  }

  // Ensure user's role is valid and known
  const userRole = assertKnownUserRole(session.user.role)
  
  // Extract main fields from form submission (minimal transformation here)
  const title = formData.get('title') as string
  const type = formData.get('type') as
    | 'offer' | 'request' | 'partnership' | 'volunteer'
    | 'mentorship' | 'resource' | 'event' | 'ring_customization'
    | 'program' | 'cv'
  const category = formData.get('category') as string
  const description = formData.get('description') as string
  const requirements = formData.get('requirements') as string
  const programSubtype = (formData.get('programSubtype') as string) || 'program'
  const eligibility = (formData.get('eligibility') as string) || ''
  const instrument = (formData.get('instrument') as string) || ''
  const geography = (formData.get('geography') as string) || ''
  const applicationUrl = (formData.get('applicationUrl') as string) || ''

  // Extract optional/numeric and auxiliary fields
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

  // Permission checks: opportunity type and confidentiality
  if (!canCreateOpportunityType(userRole, type)) {
    return { error: 'You do not have permission to create this opportunity type' }
  }
  if (isConfidential && !canCreateOpportunityConfidential(userRole)) {
    return { error: 'Only admin, superadmin, or confidential users can create confidential opportunities' }
  }

  // Business logic: handle entity vs. individual opps
  const requestTypes = ['request', 'cv']
  const organizationalTypes = [
    'offer', 'partnership', 'volunteer', 'mentorship',
    'resource', 'event', 'ring_customization', 'program',
  ]
  if (requestTypes.includes(type)) {
    entityId = null as unknown as string // Requests/CVs are always from individuals
  } else if (organizationalTypes.includes(type)) {
    if (!hasRoleAtLeast(userRole, UserRolesArray.member)) {
      return { 
        error: `Only member users and above can create ${type} opportunities. Upgrade your membership to create organizational opportunities.` 
      }
    }
    if (!entityId?.trim()) {
      return { error: `Entity is required for ${type} opportunities` }
    }
  } else {
    return { error: 'Valid opportunity type is required' }
  }

  // Field validation (server-side redundancy to prevent bad data submission)
  const fieldErrors: Record<string, string> = {}
  if (!title?.trim()) fieldErrors.title = 'Title is required'
  if (!category?.trim()) fieldErrors.category = 'Category is required'
  if (!description?.trim()) fieldErrors.description = 'Description is required'
  // Mandatory organization for "offer" / "program" type
  if ((type === 'offer' || type === 'program') && !entityId?.trim()) {
    fieldErrors.entityId = 'Entity is required for this opportunity type'
  }
  if (type === 'program' && !['program', 'investment'].includes(programSubtype)) {
    fieldErrors.programSubtype = 'Select program or investment'
  }
  // Basic email validation regex
  if (contactEmail && !/\S+@\S+\.\S+/.test(contactEmail)) {
    fieldErrors.contactEmail = 'Please enter a valid email address'
  }
  // Deadline must be in future (if supplied)
  if (deadline && new Date(deadline) <= new Date()) {
    fieldErrors.deadline = 'Deadline must be in the future'
  }

  // If any validation failed, early return with details
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors }
  }

  try {
    // Tags and skills are expected as comma-separated; parse to clean arrays.
    // TODO: Accept array directly from client if possible in Next.js 16 forms.
    const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()).filter(Boolean) : []
    const requiredSkills = requiredSkillsString ? requiredSkillsString.split(',').map(skill => skill.trim()).filter(Boolean) : []

    // Budget: only include budget if min or max is present; parse as int or undefined.
    let budgetObj = undefined
    if (budgetMin?.trim() || budgetMax?.trim()) {
      try {
        const min = budgetMin?.trim() ? parseInt(budgetMin) : undefined
        const max = budgetMax?.trim() ? parseInt(budgetMax) : undefined
        const currency = budgetCurrency?.trim() || 'USD'
        if (min !== undefined || max !== undefined) {
          // Always include both min/max as 0 fallback to simplify later rendering logic.
          budgetObj = {
            min: min ?? max ?? 0,
            max: max ?? min ?? 0,
            currency
          }
        }
      } catch (e) {
        // non-terminal, warn and skip budget
        console.warn('Could not parse budget from form fields:', { budgetMin, budgetMax, budgetCurrency })
      }
    }

    // Parse dates for Firestore (expects Timestamps, not Dates)
    const { Timestamp } = await import('firebase-admin/firestore')
    // Expiration/deadline: default to 30 days from now if not supplied
    const deadlineDate = deadline ? new Date(deadline) :
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const expirationDate = Timestamp.fromDate(deadlineDate)

    // Optional: Application deadline (can be unset)
    let applicationDeadlineTimestamp = undefined
    if (applicationDeadline?.trim()) {
      try {
        applicationDeadlineTimestamp = Timestamp.fromDate(new Date(applicationDeadline))
      } catch (e) {
        console.warn('Could not parse application deadline:', applicationDeadline)
      }
    }

    // Optional: Max applicants parsing
    let maxApplicantsNumber = undefined
    if (maxApplicants?.trim()) {
      try {
        maxApplicantsNumber = parseInt(maxApplicants)
      } catch (e) {
        console.warn('Could not parse max applicants:', maxApplicants)
      }
    }

    // Build opportunity data object, enforcing server-side shape invariant.
    // TODO: Remove unused fields or split interfaces for drafts vs. published opps for stricter typing.
    const programMeta =
      type === 'program'
        ? {
            programSubtype,
            eligibility: eligibility.trim() || undefined,
            instrument: instrument.trim() || undefined,
            geography: geography.trim() || undefined,
            applicationUrl: applicationUrl.trim() || undefined,
          }
        : undefined

    const opportunityData = {
      type,
      title: title.trim(),
      isConfidential,
      briefDescription: description.trim(),
      fullDescription: description?.trim() || '',
      createdBy: session.user.id,
      // Link organization ID if not an individual type; null for requests
      organizationId: requestTypes.includes(type) ? null : entityId?.trim() || null,
      expirationDate,
      ...(applicationDeadlineTimestamp ? { applicationDeadline: applicationDeadlineTimestamp } : {}),
      status: (formData.get('intent') === 'draft' ? 'draft' : 'pending') as 'draft' | 'pending',
      category: category.trim(),
      tags: type === 'program'
        ? [...tags, 'institution', programSubtype].filter(Boolean)
        : tags,
      location: formData.get('location')?.toString().trim() || geography.trim() || '',
      ...(budgetObj ? { budget: budgetObj } : {}), // Include budget only if parsed
      requiredSkills,
      requiredDocuments: [],
      attachments: [],
      applicantCount: 0,
      ...(maxApplicantsNumber ? { maxApplicants: maxApplicantsNumber } : {}),
      ...(priority ? { priority } : {}),
      visibility: isConfidential ? 'confidential' as const : 'public' as const,
      contactInfo: {
        linkedEntity: requestTypes.includes(type) ? '' : entityId?.trim() || '',
        contactAccount: contactEmail?.trim() || session.user.email || ''
      },
      isPrivate: requestTypes.includes(type), // Requests are private to originator
      ...(programMeta ? { metadata: programMeta } : {}),
    }

    // Import and call the actual opportunity creation service
    // STUB: This service should persist the new opp and return the DB record (TODO: replace `import()` with static import for better tree shaking)
    const { createOpportunity: createOpportunityService } = await import('@/features/opportunities/services/create-opportunity')
    
    // Attempt the actual write
    const newOpportunity = await createOpportunityService(opportunityData)
    
    // Log result for server visibility
    console.log('Opportunity created successfully:', { 
      id: newOpportunity.id, 
      title: newOpportunity.title, 
      type: newOpportunity.type,
      organizationId: newOpportunity.organizationId 
    })

    // Institution programs → email-CRM lead + review task (non-blocking)
    if (type === 'program') {
      const { ingestProgramOpportunityToEmailCrm } = await import(
        '@/features/opportunities/lib/program-crm-ingest'
      )
      await ingestProgramOpportunityToEmailCrm({
        opportunityId: newOpportunity.id,
        title: newOpportunity.title,
        subtype: programSubtype,
        submitterEmail: session.user.email,
        submitterName: session.user.name,
        submitterUserId: session.user.id,
      })
      // TODO: Admin CRM Orders page — new-order widget cards + built-in chat with
      // custom-order client (not email) bound to project_orders / program opportunities.
    }
    
    // Instead of calling redirect(), we supply a URL to the client, in line with React 19/Next.js 15+ recommendations.
    // TODO: Move notification/redirect logic fully to client components when upgrading to React Actions.
    return {
      success: true,
      message: 'Opportunity created successfully!',
      redirectUrl: `/${locale}/opportunities/status/create/success?opportunityId=${newOpportunity.id}&type=${type}&opportunityTitle=${encodeURIComponent(title)}`
    }
  } catch (error) {
    // Catch any service, validation, or runtime errors.
    console.error('Error creating opportunity:', error)
    return {
      error: 'An unexpected error occurred. Please try again.'
    }
  }
}

/**
 * Server action to update an existing opportunity.
 * Fetches existing record for permission check, applies incoming values, revalidates, and updates.
 * @returns Outcome object for client-side reducer
 */
export async function updateOpportunity(
  prevState: OpportunityFormState | null,
  formData: FormData,
  locale: Locale
): Promise<OpportunityFormState> {

  // Get current session & user
  const session = await auth()
  if (!session?.user?.id) {
    return {
      error: 'You must be logged in to update an opportunity'
    }
  }

  // Get the opportunity ID being updated
  const opportunityId = formData.get('opportunityId') as string
  if (!opportunityId) {
    return {
      error: 'Opportunity ID is required'
    }
  }

  const userRole = assertKnownUserRole(session.user.role)
  const userId = session.user.id

  try {
    // Fetch the existing opportunity to verify ownership and permissions.
    // STUB: `getOpportunityById` must ensure returned fields match update needs.
    const { getOpportunityById } = await import('@/features/opportunities/services/get-opportunity-by-id')
    const existingOpportunity = await getOpportunityById(opportunityId)
    if (!existingOpportunity) {
      return {
        error: 'Opportunity not found'
      }
    }

    if (!canEditOpportunity(userRole, existingOpportunity.createdBy, userId)) {
      return {
        error: 'You do not have permission to update this opportunity'
      }
    }

    // Extract updated fields from form again
    const title = formData.get('title') as string
    const type = formData.get('type') as string
    const category = formData.get('category') as string
    const description = formData.get('description') as string
    const requirements = formData.get('requirements') as string
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

    // Field validation (mirrors creation with additional constraints for update)
    const fieldErrors: Record<string, string> = {}
    if (!title?.trim()) fieldErrors.title = 'Title is required'
    if (!type || ![
      'offer', 'request', 'partnership', 'volunteer', 'mentorship',
      'resource', 'event', 'ring_customization'
    ].includes(type)) {
      fieldErrors.type = 'Valid type is required'
    }
    if (!category?.trim()) fieldErrors.category = 'Category is required'
    if (!description?.trim()) fieldErrors.description = 'Description is required'
    if (contactEmail && !/\S+@\S+\.\S+/.test(contactEmail)) {
      fieldErrors.contactEmail = 'Please enter a valid email address'
    }
    if (deadline && new Date(deadline) <= new Date()) {
      fieldErrors.deadline = 'Deadline must be in the future'
    }
    if (isConfidential && !canCreateOpportunityConfidential(userRole)) {
      fieldErrors.isConfidential = 'Only admin or confidential users can create confidential opportunities'
    }
    // Visibility logic: assert role-power against patch
    try {
      assertOpportunityVisibilityPatch(userRole, {
        visibility: visibility as
          | 'public' | 'subscriber' | 'member' | 'confidential' | undefined,
        isConfidential,
      })
    } catch {
      fieldErrors.visibility = 'Your role cannot set this visibility level'
    }
    if (Object.keys(fieldErrors).length > 0) {
      return { fieldErrors }
    }

    // Parse complex fields
    const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()).filter(Boolean) : []
    const requiredSkills = requiredSkillsString ? requiredSkillsString.split(',').map(skill => skill.trim()).filter(Boolean) : []

    // Budget parsing (same as create)
    let budgetObj = undefined
    if (budgetMin?.trim() || budgetMax?.trim()) {
      try {
        const min = budgetMin?.trim() ? parseInt(budgetMin) : undefined
        const max = budgetMax?.trim() ? parseInt(budgetMax) : undefined
        const currency = budgetCurrency?.trim() || 'USD'
        if (min !== undefined || max !== undefined) {
          budgetObj = {
            min: min ?? max ?? 0,
            max: max ?? min ?? 0,
            currency
          }
        }
      } catch (e) {
        console.warn('Could not parse budget from form fields:', { budgetMin, budgetMax, budgetCurrency })
      }
    }

    // Deadlines parsing
    const { Timestamp } = await import('firebase-admin/firestore')
    let expirationDate = existingOpportunity.expirationDate
    if (deadline?.trim()) {
      try {
        expirationDate = Timestamp.fromDate(new Date(deadline))
      } catch (e) {
        console.warn('Could not parse deadline:', deadline)
      }
    }
    let applicationDeadlineTimestamp = existingOpportunity.applicationDeadline
    if (applicationDeadline?.trim()) {
      try {
        applicationDeadlineTimestamp = Timestamp.fromDate(new Date(applicationDeadline))
      } catch (e) {
        console.warn('Could not parse application deadline:', applicationDeadline)
      }
    }

    // Max applicants
    let maxApplicantsNumber = existingOpportunity.maxApplicants
    if (maxApplicants?.trim()) {
      try {
        maxApplicantsNumber = parseInt(maxApplicants)
      } catch (e) {
        console.warn('Could not parse max applicants:', maxApplicants)
      }
    }

    // Prepare patch/update object (merge unchanged existing values as fallbacks)
    // TODO: Switch to "partial" object updates as interface, validated per type, for safer patches
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

    // Conditionally include optional updated fields
    if (budgetObj) updateData.budget = budgetObj
    if (expirationDate) updateData.expirationDate = expirationDate
    if (applicationDeadlineTimestamp) updateData.applicationDeadline = applicationDeadlineTimestamp
    if (maxApplicantsNumber !== undefined) updateData.maxApplicants = maxApplicantsNumber
    if (priority) updateData.priority = priority
    if (status) updateData.status = status

    // STUB: Use actual update service method. Ensure patching rules are enforced on service level.
    const { updateOpportunity: updateOpportunityService } = await import('@/features/opportunities/services/update-opportunity')
    const updatedOpportunity = await updateOpportunityService(opportunityId, updateData)
    
    console.log('Opportunity updated successfully:', { 
      id: updatedOpportunity.id, 
      title: updatedOpportunity.title, 
      type: updatedOpportunity.type 
    })
    
    // Communicate success and redirect for client
    return {
      success: true,
      message: 'Opportunity updated successfully!',
      redirectUrl: `/${locale}/opportunities/status/update/success?opportunityId=${updatedOpportunity.id}&type=${type}&opportunityTitle=${encodeURIComponent(title)}`
    }
  } catch (error) {
    // Unexpected error in update flow
    console.error('Error updating opportunity:', error)
    return {
      error: 'An unexpected error occurred. Please try again.'
    }
  }
}

/**
 * Server action to delete an existing opportunity.
 * Checks permission and archived status (enforced for owner roles).
 * Performs "soft delete" via service method.
 * @returns Outcome object for client-side reducer
 */
export async function deleteOpportunity(
  prevState: OpportunityFormState | null,
  formData: FormData,
  locale: Locale
): Promise<OpportunityFormState> {

  // Auth checks
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

  const userRole = assertKnownUserRole(session.user.role)
  const userId = session.user.id
  try {
    // STUB: This fetch must pull at least createdBy, status, title.
    const { getOpportunityById } = await import('@/features/opportunities/services/get-opportunity-by-id')
    const existingOpportunity = await getOpportunityById(opportunityId)
    if (!existingOpportunity) {
      return {
        error: 'Opportunity not found'
      }
    }
    // Role-based permission for deletion
    if (!canDeleteOpportunity(userRole, existingOpportunity.createdBy, userId)) {
      return {
        error: 'You do not have permission to delete this opportunity'
      }
    }

    // If user is the owner (but not platform admin), only allow deletion of archived listings.
    const isOwner = existingOpportunity.createdBy === userId
    if (isOwner && !isPlatformAdmin(userRole) && existingOpportunity.status !== 'archived') {
      return {
        error: 'Only archived opportunities can be deleted. Archive the listing first.',
      }
    }

    // STUB: Service must ensure soft-delete and preserve record in DB for admin restore/audit.
    const { deleteOpportunity: deleteOpportunityService } = await import('@/features/opportunities/services/delete-opportunity')
    await deleteOpportunityService(opportunityId)
    
    console.log('Opportunity deleted successfully:', { 
      id: opportunityId, 
      title: existingOpportunity.title, 
      deletedBy: userId 
    })
    
    // Provide redirectUrl to allow client navigation/handling
    return {
      success: true,
      message: 'Opportunity deleted successfully!',
      redirectUrl: `/${locale}/opportunities/status/delete/success?opportunityId=${opportunityId}&opportunityTitle=${encodeURIComponent(existingOpportunity.title)}`
    }
  } catch (error) {
    console.error('Error deleting opportunity:', error)
    return {
      error: 'An unexpected error occurred. Please try again.'
    }
  }
}