import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { ConversationService } from '@/features/chat/services/conversation-service'
import { CreateConversationRequest, ConversationFilters, PaginationOptions } from '@/features/chat/types'

const conversationService = new ConversationService()

// ---------------------------------------------------------------------------
// Create-conversation schema — validates the body at the route layer.
// Uses superRefine for conditional metadata requirements:
//   - type='entity' → metadata.entityId required
//   - type='opportunity' → metadata.opportunityId required
//   - type='direct' → metadata optional
// ---------------------------------------------------------------------------
const createConversationSchema = z.object({
  type: z.enum(['direct', 'entity', 'opportunity', 'product', 'group', 'order_lab']),
  participantIds: z.array(z.string()).min(1, 'participantIds must be a non-empty array'),
  metadata: z.object({
    entityId: z.string().optional(),
    entityName: z.string().optional(),
    opportunityId: z.string().optional(),
    opportunityName: z.string().optional(),
    directUserId: z.string().optional(),
    directUserName: z.string().optional(),
    productId: z.string().optional(),
    productName: z.string().optional(),
    subject: z.string().optional(),
    vendorId: z.string().optional(),
    groupName: z.string().optional(),
    kind: z.string().optional(),
    hiddenFromInbox: z.boolean().optional(),
    orderId: z.string().optional(),
  }).optional(),
}).passthrough().superRefine((data, ctx) => {
  if (data.type !== 'direct' && !data.metadata) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `metadata is required for ${data.type} conversations`,
      path: ['metadata'],
    })
  }
  if (data.type === 'entity' && data.metadata && !data.metadata.entityId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'entityId is required for entity conversations',
      path: ['metadata', 'entityId'],
    })
  }
  if (data.type === 'opportunity' && data.metadata && !data.metadata.opportunityId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'opportunityId is required for opportunity conversations',
      path: ['metadata', 'opportunityId'],
    })
  }
  if (data.type === 'order_lab' && data.metadata && !data.metadata.orderId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'orderId is required for order_lab conversations',
      path: ['metadata', 'orderId'],
    })
  }
  if (data.type === 'group') {
    const name = data.metadata?.groupName?.trim()
    if (!name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'groupName is required for group conversations',
        path: ['metadata', 'groupName'],
      })
    }
    if (data.participantIds.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'group conversations require at least one other participant',
        path: ['participantIds'],
      })
    }
  }
})

export async function GET(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  // Track the context of this GET request
  const requestContext = {
    timestamp: Date.now(),
    endpoint: '/api/conversations',
    method: 'GET'
  } as any;

  try {
    // Check session for an authenticated user
    const session = await auth()
    requestContext.hasSession ??= !!session;
    requestContext.hasUser ??= !!session?.user;
    requestContext.userId ??= session?.user?.id;

    if (!session?.user?.id) {
      // User must be authenticated
      return NextResponse.json({
        error: 'Unauthorized',
        context: { timestamp: requestContext.timestamp }
      }, { status: 401 })
    }

    // Extract search params from URL
    const { searchParams } = new URL(request.url)
    const filters: ConversationFilters = {}
    const validFilterKeys = ['type', 'isActive', 'entityId', 'opportunityId', 'productId'];

    // Convert query parameters into a simple object
    const queryParams = Object.fromEntries(searchParams.entries());

    // Apply filtering if the params are valid
    for (const key of validFilterKeys) {
      if (Object.hasOwn(queryParams, key) && queryParams[key] !== null) {
        switch (key) {
          case 'type':
            // Only include supported conversation types
            if (['direct', 'entity', 'opportunity', 'product', 'group', 'order_lab'].includes(queryParams[key])) {
              filters.type = queryParams[key] as ConversationFilters['type']
            }
            break;
          case 'isActive':
            // Convert string to boolean
            filters.isActive = queryParams[key] === 'true';
            break;
          case 'entityId':
          case 'opportunityId':
          case 'productId':
            // Accept only non-empty strings
            if (typeof queryParams[key] === 'string' && queryParams[key].trim()) {
              filters[key] = queryParams[key];
            }
            break;
        }
      }
    }

    // Handle pagination (limit + cursor)
    const pagination: PaginationOptions = {}
    if (Object.hasOwn(queryParams, 'limit') && queryParams.limit) {
      const limitValue = parseInt(queryParams.limit, 10);
      if (!isNaN(limitValue) && limitValue > 0 && limitValue <= 100) {
        pagination.limit = limitValue;
      }
    }
    if (Object.hasOwn(queryParams, 'cursor') && queryParams.cursor) {
      pagination.cursor = queryParams.cursor;
    }
    // Set default limit if not supplied
    pagination.limit ??= 20;

    requestContext.appliedFilters ??= Object.keys(filters); // Track which filters were applied
    requestContext.pagination ??= pagination;

    // Log for debugging and monitoring
    console.log('API: /api/conversations GET - Processing request:', {
      userId: session.user.id,
      filters: requestContext.appliedFilters,
      pagination: requestContext.pagination
    });

    // Get conversations from the ConversationService
    const conversations = await conversationService.getConversations(
      session.user.id,
      filters,
      pagination
    )

    // TODO: Consider supporting native Next.js Response caching and revalidation with headers if chat is not ultra-realtime.

    return NextResponse.json({
      success: true,
      data: conversations,
      pagination: {
        // Infer if more results exist for infinite scroll UIs
        hasMore: conversations.length === (pagination.limit || 20),
        cursor: conversations.length > 0 ? conversations[conversations.length - 1].id : null
      },
      metadata: {
        timestamp: requestContext.timestamp,
        total: conversations.length,
        filters: requestContext.appliedFilters
      }
    })

  } catch (error) {
    // Generic error reporting
    console.error('Error fetching conversations:', error)
    return NextResponse.json({
      error: 'Failed to fetch conversations',
      context: {
        ...requestContext,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  // Track the context of this POST request
  const requestContext = {
    timestamp: Date.now(),
    endpoint: '/api/conversations',
    method: 'POST'
  } as any;

  try {
    // Require authentication for creating conversations
    const session = await auth()
    requestContext.hasSession ??= !!session;
    requestContext.hasUser ??= !!session?.user;
    requestContext.userId ??= session?.user?.id;

    if (!session?.user?.id) {
      // User must be authenticated
      return NextResponse.json({
        error: 'Unauthorized',
        context: { timestamp: requestContext.timestamp }
      }, { status: 401 })
    }

    // Parse and validate body with Zod — replaces ~80 lines of manual validation
    let requestData: CreateConversationRequest
    try {
      const raw = await request.json()
      const parsed = createConversationSchema.safeParse(raw)
      if (!parsed.success) {
        return NextResponse.json({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
          context: { timestamp: requestContext.timestamp }
        }, { status: 400 })
      }
      requestData = parsed.data as CreateConversationRequest
    } catch {
      return NextResponse.json({
        error: 'Invalid JSON in request body',
        context: { timestamp: requestContext.timestamp }
      }, { status: 400 })
    }

    // order_lab rooms are SSOT via Order Lab bootstrap (buyer+integrator+Reggie + metadata lock).
    // Public create would allow a first writer to mint a broken room without Reggie/hiddenFromInbox.
    if (requestData.type === 'order_lab') {
      return NextResponse.json({
        error:
          'order_lab conversations must be created via Order Lab chat bootstrap (GET /api/my-jobs/[id]/chat)',
        context: { timestamp: requestContext.timestamp },
      }, { status: 403 })
    }

    // Ensure current user is included; creatorUserId makes them admin regardless of array order
    if (!requestData.participantIds.includes(session.user.id)) {
      requestData.participantIds = [session.user.id, ...requestData.participantIds]
    }
    requestData.creatorUserId = session.user.id
    if (requestData.type === 'group' && requestData.metadata?.groupName) {
      requestData.metadata = {
        ...requestData.metadata,
        groupName: requestData.metadata.groupName.trim(),
      }
    }

    // Attach info to context for logging/analytics
    requestContext.conversationType ??= requestData.type;
    requestContext.participantCount ??= requestData.participantIds.length;
    requestContext.hasMetadata ??= !!requestData.metadata;

    // Log for observability
    console.log('API: /api/conversations POST - Creating conversation:', {
      userId: session.user.id,
      type: requestContext.conversationType,
      participantCount: requestContext.participantCount,
      hasMetadata: requestContext.hasMetadata
    });

    // Actually create the conversation
    const conversation = await conversationService.createConversation(requestData as CreateConversationRequest)

    // TODO: Consider returning a Location header (201 Created best practice) pointing to new conversation resource

    return NextResponse.json({
      success: true,
      data: conversation,
      metadata: {
        timestamp: requestContext.timestamp,
        created: true
      }
    }, { status: 201 })

  } catch (error) {
    // Log and report error details, including for internal tracking
    console.error('Error creating conversation:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to create conversation',
      context: {
        ...requestContext,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}