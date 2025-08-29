// 🚀 OPTIMIZED SERVER ACTIONS: Store address management
// - React 19 useActionState() compatible server actions
// - Zod validation with field-specific error handling
// - Auth.js v5 session management
// - Direct Firebase service manager imports

'use server'

import { auth } from '@/auth'
import { z } from 'zod'
import { AddressService, type UserAddress } from '@/features/store/services/address-service'
import { logger } from '@/lib/logger'

// Form state interface for React 19 useActionState
export interface AddressFormState {
  success?: boolean
  error?: string
  message?: string
  fieldErrors?: Record<string, string>
}

// Validation schemas
const createAddressSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(100),
  phone: z.string().optional(),
  country: z.string().min(1, 'Country is required').max(50),
  city: z.string().min(1, 'City is required').max(50),
  postalCode: z.string().optional(),
  addressLine1: z.string().min(1, 'Address line 1 is required').max(200),
  addressLine2: z.string().optional(),
  isDefault: z.boolean().optional()
})

const updateAddressSchema = createAddressSchema.extend({
  id: z.string().min(1, 'Address ID is required')
})

const deleteAddressSchema = z.object({
  id: z.string().min(1, 'Address ID is required')
})

/**
 * Creates a new shipping address for the authenticated user
 */
export async function createUserAddress(
  prevState: AddressFormState | null,
  formData: FormData
): Promise<AddressFormState> {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    // Parse and validate form data
    const rawData = {
      fullName: formData.get('fullName') as string,
      phone: formData.get('phone') as string || undefined,
      country: formData.get('country') as string,
      city: formData.get('city') as string,
      postalCode: formData.get('postalCode') as string || undefined,
      addressLine1: formData.get('addressLine1') as string,
      addressLine2: formData.get('addressLine2') as string || undefined,
      isDefault: formData.get('isDefault') === 'true'
    }

    const validationResult = createAddressSchema.safeParse(rawData)
    
    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {}
      validationResult.error.issues.forEach((issue) => {
        if (issue.path.length > 0) {
          fieldErrors[issue.path[0] as string] = issue.message
        }
      })
      
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors
      }
    }

    // Create address
    const addressId = await AddressService.create(session.user.id, validationResult.data)
    
    logger.info('Store Address Action: Address created successfully', {
      userId: session.user.id,
      addressId
    })

    return {
      success: true,
      message: 'Address created successfully'
    }

  } catch (error) {
    logger.error('Store Address Action: Error creating address', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create address'
    }
  }
}

/**
 * Updates an existing shipping address for the authenticated user
 */
export async function updateUserAddress(
  prevState: AddressFormState | null,
  formData: FormData
): Promise<AddressFormState> {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    // Parse and validate form data
    const rawData = {
      id: formData.get('id') as string,
      fullName: formData.get('fullName') as string,
      phone: formData.get('phone') as string || undefined,
      country: formData.get('country') as string,
      city: formData.get('city') as string,
      postalCode: formData.get('postalCode') as string || undefined,
      addressLine1: formData.get('addressLine1') as string,
      addressLine2: formData.get('addressLine2') as string || undefined,
      isDefault: formData.get('isDefault') === 'true'
    }

    const validationResult = updateAddressSchema.safeParse(rawData)
    
    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {}
      validationResult.error.issues.forEach((issue) => {
        if (issue.path.length > 0) {
          fieldErrors[issue.path[0] as string] = issue.message
        }
      })
      
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors
      }
    }

    // Update address
    const { id, ...updateData } = validationResult.data
    await AddressService.update(session.user.id, id, updateData)
    
    logger.info('Store Address Action: Address updated successfully', {
      userId: session.user.id,
      addressId: id
    })

    return {
      success: true,
      message: 'Address updated successfully'
    }

  } catch (error) {
    logger.error('Store Address Action: Error updating address', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update address'
    }
  }
}

/**
 * Deletes a shipping address for the authenticated user
 */
export async function deleteUserAddress(
  prevState: AddressFormState | null,
  formData: FormData
): Promise<AddressFormState> {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    // Parse and validate form data
    const rawData = {
      id: formData.get('id') as string
    }

    const validationResult = deleteAddressSchema.safeParse(rawData)
    
    if (!validationResult.success) {
      return {
        success: false,
        error: 'Invalid address ID'
      }
    }

    // Delete address
    await AddressService.remove(session.user.id, validationResult.data.id)
    
    logger.info('Store Address Action: Address deleted successfully', {
      userId: session.user.id,
      addressId: validationResult.data.id
    })

    return {
      success: true,
      message: 'Address deleted successfully'
    }

  } catch (error) {
    logger.error('Store Address Action: Error deleting address', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete address'
    }
  }
}

/**
 * Sets an address as the default for the authenticated user
 */
export async function setDefaultUserAddress(
  prevState: AddressFormState | null,
  formData: FormData
): Promise<AddressFormState> {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    // Parse and validate form data
    const rawData = {
      id: formData.get('id') as string
    }

    const validationResult = deleteAddressSchema.safeParse(rawData)
    
    if (!validationResult.success) {
      return {
        success: false,
        error: 'Invalid address ID'
      }
    }

    // Set as default
    await AddressService.setDefault(session.user.id, validationResult.data.id)
    
    logger.info('Store Address Action: Default address set successfully', {
      userId: session.user.id,
      addressId: validationResult.data.id
    })

    return {
      success: true,
      message: 'Default address updated successfully'
    }

  } catch (error) {
    logger.error('Store Address Action: Error setting default address', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set default address'
    }
  }
}

/**
 * Gets all addresses for the authenticated user (non-action helper)
 */
export async function getUserAddresses(): Promise<UserAddress[]> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return []
    }

    return await AddressService.list(session.user.id)
  } catch (error) {
    logger.error('Store Address Action: Error getting user addresses', error)
    return []
  }
}
