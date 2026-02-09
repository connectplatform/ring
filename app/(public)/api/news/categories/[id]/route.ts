import { NextRequest, NextResponse, connection} from 'next/server'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { NewsCategory } from '@/features/news/types'

/**
 * GET /api/news/categories/[id]
 * Fetch a specific news category by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const { id } = params

    await initializeDatabase()
    const db = getDatabaseService()

    const categoryResult = await db.read('newsCategories', id)
    
    if (!categoryResult.success || !categoryResult.data) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      )
    }

    const category = categoryResult.data as any

    return NextResponse.json({
      success: true,
      data: { id, ...category },
    })

  } catch (error) {
    console.error('Error fetching news category:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch news category' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/news/categories/[id]
 * Update a news category (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { id } = params
    const { name, description, color, icon } = await request.json()

    // Validate required fields
    if (!name || !color || !icon) {
      return NextResponse.json(
        { success: false, error: 'Name, color, and icon are required' },
        { status: 400 }
      )
    }

    // Category existence will be checked by update operation

    await initializeDatabase()
    const db = getDatabaseService()
    
    const updateData = {
      name: name.trim(),
      description: description?.trim() || '',
      color: color.trim(),
      icon: icon.trim(),
      updatedAt: new Date(),
    }

    const updateResult = await db.update('newsCategories', id, updateData)
    if (!updateResult.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to update category' },
        { status: 500 }
      )
    }

    // Revalidate news pages (React 19 pattern)
    revalidatePath('/[locale]/news')
    revalidatePath('/[locale]/admin/news/categories')

    return NextResponse.json({
      success: true,
      data: { id, ...updateResult.data },
      message: 'Category updated successfully',
    })

  } catch (error) {
    console.error('Error updating news category:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update news category' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/news/categories/[id]
 * Delete a news category (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { id } = params

    await initializeDatabase()
    const db = getDatabaseService()

    // Check if category exists
    const categoryResult = await db.read('newsCategories', id)
    if (!categoryResult.success || !categoryResult.data) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      )
    }

    // Check if any articles are using this category
    const articlesResult = await db.query({
      collection: 'news',
      filters: [{ field: 'category', operator: '==', value: id as NewsCategory }],
      pagination: { limit: 1 }
    })

    if (articlesResult.success && articlesResult.data.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot delete category that is being used by articles. Please reassign or delete those articles first.' 
        },
        { status: 400 }
      )
    }

    // Delete the category (MUTATION - NO CACHE!)
    const deleteResult = await db.delete('newsCategories', id)
    if (!deleteResult.success) {
      throw deleteResult.error || new Error('Failed to delete category')
    }

    // Revalidate (React 19 pattern)
    revalidatePath('/[locale]/admin/news/categories')

    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully',
    })

  } catch (error) {
    console.error('Error deleting news category:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete news category' },
      { status: 500 }
    )
  }
} 