import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { 
  getCachedDocument,
  updateDocument,
  deleteDocument,
  createBatchWriter,
  executeBatch
} from '@/lib/services/firebase-service-manager'
import { getAdminDb } from '@/lib/firebase-admin.server'
import { FieldValue } from 'firebase-admin/firestore'
import { NewsCategory, NewsStatus } from '@/features/news/types'

interface BulkOperationRequest {
  operation: 'publish' | 'archive' | 'delete' | 'updateCategory'
  articleIds: string[]
  data?: {
    category?: NewsCategory
    status?: NewsStatus
  }
}

/**
 * POST /api/news/bulk
 * Perform bulk operations on multiple news articles
 */
export async function POST(request: NextRequest) {
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

    const body: BulkOperationRequest = await request.json()
    const { operation, articleIds, data } = body

    // Validate request
    if (!operation || !articleIds || !Array.isArray(articleIds) || articleIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid request: operation and articleIds are required' },
        { status: 400 }
      )
    }

    if (articleIds.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Too many articles selected (max 100)' },
        { status: 400 }
      )
    }

    const batch = createBatchWriter()
    
    let successCount = 0
    let failedIds: string[] = []

    // Process each article
    for (const articleId of articleIds) {
      try {
        // Verify article exists using firebase-service-manager
        const articleDoc = await getCachedDocument('news', articleId)
        if (!articleDoc || !articleDoc.exists) {
          failedIds.push(articleId)
          continue
        }

        // Get document reference for batch operations
        const db = getAdminDb()
        const articleRef = db.collection('news').doc(articleId)
        
        // Apply operation
        switch (operation) {
          case 'publish':
            batch.update(articleRef, {
              status: 'published' as NewsStatus,
              publishedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp()
            })
            break

          case 'archive':
            batch.update(articleRef, {
              status: 'archived' as NewsStatus,
              updatedAt: FieldValue.serverTimestamp()
            })
            break

          case 'delete':
            batch.delete(articleRef)
            break

          case 'updateCategory':
            if (!data?.category) {
              failedIds.push(articleId)
              continue
            }
            batch.update(articleRef, {
              category: data.category,
              updatedAt: FieldValue.serverTimestamp()
            })
            break

          default:
            failedIds.push(articleId)
            continue
        }

        successCount++
      } catch (error) {
        console.error(`Error processing article ${articleId}:`, error)
        failedIds.push(articleId)
      }
    }

    // Commit batch operation using firebase-service-manager
    if (successCount > 0) {
      try {
        await executeBatch(batch)
      } catch (error) {
        console.error('Batch commit failed:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to commit batch operation' },
          { status: 500 }
        )
      }
    }

    // Prepare response
    const response: any = {
      success: successCount > 0,
      processed: successCount,
      failed: failedIds.length,
      total: articleIds.length
    }

    if (operation === 'delete') {
      response.message = `Successfully deleted ${successCount} articles`
    } else if (operation === 'publish') {
      response.message = `Successfully published ${successCount} articles`
    } else if (operation === 'archive') {
      response.message = `Successfully archived ${successCount} articles`
    } else if (operation === 'updateCategory') {
      response.message = `Successfully updated category for ${successCount} articles`
    }

    if (failedIds.length > 0) {
      response.failedIds = failedIds
      response.warning = `${failedIds.length} articles could not be processed`
    }

    const statusCode = successCount > 0 ? 200 : 400
    return NextResponse.json(response, { status: statusCode })

  } catch (error) {
    console.error('Bulk operation error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error during bulk operation' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/news/bulk/status
 * Check the status of a bulk operation (for future implementation with job queues)
 */
export async function GET(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('jobId')

  if (!jobId) {
    return NextResponse.json(
      { success: false, error: 'Job ID is required' },
      { status: 400 }
    )
  }

  // TODO: Implement job status checking with Redis or database
  // For now, return a mock response
  return NextResponse.json({
    success: true,
    jobId,
    status: 'completed',
    progress: 100,
    processed: 10,
    total: 10,
    message: 'Bulk operation completed successfully'
  })
} 