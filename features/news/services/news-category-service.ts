/**
 * News Category Service
 *
 * CRUD operations for the news_categories collection.
 *
 * Uses caching for deduplication of read (GET) calls using React's cache().
 * For mutation (create, update, delete) calls, operates directly on the db().
 * Never throws: always returns a unified result object (see CategoryActionResult).
 *
 * All function return shapes are normalized and error-safe.
 *
 * TODO: Investigate new React 19/Next 16 data cache primitives for further optimizations.
 */

import { cache } from 'react'
import { db } from '@/lib/database'
import { mapNewsCategoryDocument } from '@/lib/news/map-news-document'
import type { NewsCategoryInfo } from '@/features/news/types'
import { logger } from '@/lib/logger'

export interface CategoryActionResult {
  success: boolean
  data?: NewsCategoryInfo
  error?: string
  message?: string
}

/**
 * Fetch all news categories, sorted by name.
 * Uses React's cache utility for request deduplication. (React 18+/19+)
 * 
 * @returns Array of NewsCategoryInfo, returns [] (never throws) on error.
 */
export const getCategories = cache(
  async (): Promise<NewsCategoryInfo[]> => {
    try {
      // Query all documents in 'news_categories', ordered asc by name
      const result = await db().queryDocs<Record<string, unknown>>({
        collection: 'news_categories',
        orderBy: [{ field: 'name', direction: 'asc' }],
      })

      if (!result.success || !result.data) {
        // Log and return fallback ([])
        logger.warn('getCategories: query failed', { success: result.success })
        return []
      }

      // Map db documents into application-level NewsCategoryInfo
      return result.data.map((row) => mapNewsCategoryDocument(row))
    } catch (error) {
      // Defensive: log and gracefully degrade to []
      logger.error('getCategories: Error', {
        error: error instanceof Error ? error.message : error,
      })
      return []
    }
  },
  // TODO: Use React 19 cache keys for enhanced deduplication when available 
)

/**
 * Fetch a single category by its ID (cached per id).
 * 
 * @param categoryId
 * @returns NewsCategoryInfo | null if not found or error
 */
export const getCategoryById = cache(
  async (categoryId: string): Promise<NewsCategoryInfo | null> => {
    if (!categoryId) return null

    try {
      // Fetch document by ID from 'news_categories'
      const result = await db().readDoc<Record<string, unknown>>(
        'news_categories',
        categoryId,
      )

      if (!result.success || !result.data) {
        logger.warn('getCategoryById: not found', { categoryId })
        return null
      }

      // Map db document to application category type
      return mapNewsCategoryDocument(result.data)
    } catch (error) {
      // Log errors, but never throw, always null
      logger.error('getCategoryById: Error', {
        categoryId,
        error: error instanceof Error ? error.message : error,
      })
      return null
    }
  },
  // TODO: React 19 cache with params as input key
)

/**
 * Create a new news category entry.
 *
 * @param data The category details (name required, plus optional fields)
 * @returns CategoryActionResult indicating success, error, and resulting data/message
 */
export async function createCategory(data: {
  name: string
  description?: string
  color?: string
  icon?: string
}): Promise<CategoryActionResult> {
  try {
    // Validate that required name property is present (non-empty after trim)
    if (!data.name?.trim()) {
      return { success: false, error: 'Category name is required' }
    }

    // TODO: Use a schema validation (e.g. zod) or Next/React form validator for dev and user feedback

    // Compose the creation object for db insertion
    const result = await db().createDoc('news_categories', {
      name: data.name.trim(),
      description: data.description?.trim() ?? '',
      color: data.color ?? 'bg-gray-500', // Default color if not given
      icon: data.icon ?? '📰',           // Default icon if not given
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    if (!result.success) {
      // Normalize db layer error for UI/consumer safety
      throw result.error || new Error('Failed to create category')
    }

    // Return created category (mapped)
    return {
      success: true,
      data: mapNewsCategoryDocument(result.data),
      message: `Category "${data.name}" created successfully`,
    }
  } catch (error) {
    // Strong error log for auditing
    logger.error('createCategory: Error', {
      name: data.name,
      error: error instanceof Error ? error.message : error,
    })
    // Never throw; always return normalized error
    return { success: false, error: 'Failed to create category' }
  }
}

/**
 * Update an existing news category.
 * 
 * @param categoryId ID of the category to update
 * @param data Fields to update
 * @returns CategoryActionResult with updated data or error message
 */
export async function updateCategory(
  categoryId: string,
  data: {
    name?: string
    description?: string
    color?: string
    icon?: string
  },
): Promise<CategoryActionResult> {
  try {
    // Validate presence of category ID
    if (!categoryId) {
      return { success: false, error: 'Category ID is required' }
    }

    // Build up new update data with only specified keys
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(), // Always update mod time
    }

    // Only attach properties that are defined in input
    if (data.name !== undefined) updateData.name = data.name.trim()
    if (data.description !== undefined) updateData.description = data.description.trim()
    if (data.color !== undefined) updateData.color = data.color
    if (data.icon !== undefined) updateData.icon = data.icon

    // TODO: Consider: If all fields undefined, skip update or report "nothing to update"

    // Execute mutation in DB
    const result = await db().updateDoc('news_categories', categoryId, updateData)

    if (!result.success) {
      throw result.error || new Error('Failed to update category')
    }

    // Map result and return with success
    return {
      success: true,
      data: mapNewsCategoryDocument(result.data),
      message: `Category updated successfully`,
    }
  } catch (error) {
    logger.error('updateCategory: Error', {
      categoryId,
      error: error instanceof Error ? error.message : error,
    })
    return { success: false, error: 'Failed to update category' }
  }
}

/**
 * Delete a news category by its ID.
 *
 * @param categoryId
 * @returns CategoryActionResult indicating success or error
 */
export async function deleteCategory(
  categoryId: string,
): Promise<CategoryActionResult> {
  try {
    // Defensive: must have ID provided to proceed
    if (!categoryId) {
      return { success: false, error: 'Category ID is required' }
    }

    // Perform the delete DB operation
    const result = await db().deleteDoc('news_categories', categoryId)

    if (!result.success) {
      throw result.error || new Error('Failed to delete category')
    }

    // Indicate completion; no data returned on delete
    return {
      success: true,
      message: 'Category deleted successfully',
    }
  } catch (error) {
    logger.error('deleteCategory: Error', {
      categoryId,
      error: error instanceof Error ? error.message : error,
    })
    return { success: false, error: 'Failed to delete category' }
  }
}

// MOCK CODE, TODO: Add stubs for news category permissions and role restrictions.
// - Step 1: Define permission checking API (accepts user/context)
// - Step 2: Integrate into create/update/delete logic (guard by role)
// - Step 3: Add comprehensive tests for all entrypoints and error paths