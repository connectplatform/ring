import { NextRequest, NextResponse } from 'next/server'
import { getNewsCategoriesCollection, getNewsCollection } from '@/lib/firestore-collections'
import { auth } from '@/auth'
import { FieldValue } from 'firebase-admin/firestore'
import { NewsCategory } from '@/features/news/types'

/**
 * GET /api/news/categories/[id]
 * Fetch a specific news category by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const categoriesCollection = getNewsCategoriesCollection()

    const categoryDoc = await categoriesCollection.doc(id).get()
    
    if (!categoryDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      )
    }

    const category = categoryDoc.data()

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

    const categoriesCollection = getNewsCategoriesCollection()
    
    // Check if category exists
    const categoryDoc = await categoriesCollection.doc(id).get()
    if (!categoryDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      )
    }

    const updateData = {
      name: name.trim(),
      description: description?.trim() || '',
      color: color.trim(),
      icon: icon.trim(),
      updatedAt: FieldValue.serverTimestamp(),
    }

    await categoriesCollection.doc(id).update(updateData)

    const updatedCategory = await categoriesCollection.doc(id).get()

    return NextResponse.json({
      success: true,
      data: { id, ...updatedCategory.data() },
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
    const categoriesCollection = getNewsCategoriesCollection()
    const newsCollection = getNewsCollection()

    // Check if category exists
    const categoryDoc = await categoriesCollection.doc(id).get()
    if (!categoryDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      )
    }

    // Check if any articles are using this category
    const articlesWithCategory = await newsCollection
      .where('category', '==', id as NewsCategory)
      .limit(1)
      .get()

    if (!articlesWithCategory.empty) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot delete category that is being used by articles. Please reassign or delete those articles first.' 
        },
        { status: 400 }
      )
    }

    // Delete the category
    await categoriesCollection.doc(id).delete()

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