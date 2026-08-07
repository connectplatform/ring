import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { db } from '@/lib/database'
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
 * Perform bulk operations on multiple news articles via db() SSOT.
 */
export async function POST(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      )
    }

    if (!isPlatformAdmin(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 },
      )
    }

    const body: BulkOperationRequest = await request.json()
    const { operation, articleIds, data } = body

    if (!operation || !articleIds || !Array.isArray(articleIds) || articleIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid request: operation and articleIds are required' },
        { status: 400 },
      )
    }

    if (articleIds.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Too many articles selected (max 100)' },
        { status: 400 },
      )
    }

    let successCount = 0
    const failedIds: string[] = []
    const now = new Date()

    for (const articleId of articleIds) {
      try {
        const articleDoc = await db().readDoc('news', articleId)
        if (!articleDoc.success || !articleDoc.data) {
          failedIds.push(articleId)
          continue
        }

        let updatePayload: Record<string, unknown> | null = null

        switch (operation) {
          case 'publish':
            updatePayload = {
              status: 'published' as NewsStatus,
              publishedAt: now,
              updatedAt: now,
            }
            break

          case 'archive':
            updatePayload = {
              status: 'archived' as NewsStatus,
              updatedAt: now,
            }
            break

          case 'delete':
            updatePayload = {
              status: 'deleted' as NewsStatus,
              deletedAt: now,
              deletedBy: session.user.id || session.user.email || '',
              updatedAt: now,
            }
            break

          case 'updateCategory':
            if (!data?.category) {
              failedIds.push(articleId)
              continue
            }
            updatePayload = {
              category: data.category,
              updatedAt: now,
            }
            break

          default:
            failedIds.push(articleId)
            continue
        }

        const updateResult = await db().updateDoc('news', articleId, updatePayload)
        if (!updateResult.success) {
          failedIds.push(articleId)
          continue
        }

        successCount++
      } catch (error) {
        console.error(`Error processing article ${articleId}:`, error)
        failedIds.push(articleId)
      }
    }

    if (successCount > 0) {
      const { syncNewsDiscovery } = await import('@/features/news/lib/news-mutation-sync')
      const eventMap: Record<string, 'published' | 'deleted' | 'updated' | 'status_changed'> = {
        publish: 'published',
        archive: 'status_changed',
        delete: 'deleted',
        updateCategory: 'updated',
      }
      await syncNewsDiscovery({
        event: eventMap[operation] || 'updated',
      })
    }

    const response: Record<string, unknown> = {
      success: successCount > 0,
      processed: successCount,
      failed: failedIds.length,
      total: articleIds.length,
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
      { status: 500 },
    )
  }
}

/**
 * GET /api/news/bulk?jobId=…
 * Job-queue status is not implemented yet — returns 501 so clients do not treat mocks as success.
 */
export async function GET(request: NextRequest) {
  await connection()

  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('jobId')

  if (!jobId) {
    return NextResponse.json(
      { success: false, error: 'Job ID is required' },
      { status: 400 },
    )
  }

  return NextResponse.json(
    {
      success: false,
      error: 'Bulk job status tracking is not implemented',
      jobId,
      status: 'unsupported',
    },
    { status: 501 },
  )
}
