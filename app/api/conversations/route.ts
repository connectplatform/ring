import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { ConversationService } from '@/features/chat/services/conversation-service'
import { CreateConversationRequest, ConversationFilters, PaginationOptions } from '@/features/chat/types'
import { hasOwnProperty, validateRequiredFields, filterObjectProperties } from '@/lib/utils'

const conversationService = new ConversationService()

export async function GET(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  // ES2022 Logical Assignment for request context
  const requestContext = {
    timestamp: Date.now(),
    endpoint: '/api/conversations',
    method: 'GET'
  } as any;

  try {
    const session = await auth()
    
    // ES2022 logical assignment for context building
    requestContext.hasSession ??= !!session;
    requestContext.hasUser ??= !!session?.user;
    requestContext.userId ??= session?.user?.id;
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        context: { timestamp: requestContext.timestamp }
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    
    // Parse filters from query parameters, with Object.hasOwn() validation
    const filters: ConversationFilters = {}
    const validFilterKeys = ['type', 'isActive', 'entityId', 'opportunityId'];
    
    // ES2022 Object.hasOwn() for safe query parameter validation
    const queryParams = Object.fromEntries(searchParams.entries());
    
    for (const key of validFilterKeys) {
      if (Object.hasOwn(queryParams, key) && queryParams[key] !== null) {
        switch (key) {
          case 'type':
            if (['direct', 'entity', 'opportunity'].includes(queryParams[key])) {
              filters.type = queryParams[key] as 'direct' | 'entity' | 'opportunity'
            }
            break;
          case 'isActive':
            filters.isActive = queryParams[key] === 'true';
            break;
          case 'entityId':
          case 'opportunityId':
            if (typeof queryParams[key] === 'string' && queryParams[key].trim()) {
              filters[key] = queryParams[key];
            }
            break;
        }
      }
    }

    // Parse pagination options, with Object.hasOwn() validation
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

    // ES2022 logical assignment for defaults
    pagination.limit ??= 20;
    requestContext.appliedFilters ??= Object.keys(filters);
    requestContext.pagination ??= pagination;

    console.log('API: /api/conversations GET - Processing request:', {
      userId: session.user.id,
      filters: requestContext.appliedFilters,
      pagination: requestContext.pagination
    });

    // Get user conversations with enhanced error handling, pagination and filtering
    const conversations = await conversationService.getConversations(
      session.user.id,
      filters,
      pagination
    )

    return NextResponse.json({
      success: true,
      data: conversations,
      pagination: {
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

  // ES2022 Logical Assignment for request context
  const requestContext = {
    timestamp: Date.now(),
    endpoint: '/api/conversations',
    method: 'POST'
  } as any;

  try {
    const session = await auth()
    
    // ES2022 logical assignment for context building
    requestContext.hasSession ??= !!session;
    requestContext.hasUser ??= !!session?.user;
    requestContext.userId ??= session?.user?.id;
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        context: { timestamp: requestContext.timestamp }
      }, { status: 401 })
    }

    // Enhanced request body parsing and validation
    let requestData: any;
    try {
      requestData = await request.json();
    } catch (error) {
      return NextResponse.json({
        error: 'Invalid JSON in request body',
        context: { timestamp: requestContext.timestamp }
      }, { status: 400 });
    }

    // ES2022 Object.hasOwn() for safe request data validation
    if (!requestData || typeof requestData !== 'object' || requestData === null) {
      return NextResponse.json({
        error: 'Request body must be a valid object',
        context: { timestamp: requestContext.timestamp }
      }, { status: 400 });
    }

    // Validate required fields using Object.hasOwn()
    const requiredFields = ['type', 'participantIds'];
    const missingFields = requiredFields.filter(field => !Object.hasOwn(requestData, field));
    
    if (missingFields.length > 0) {
      return NextResponse.json({
        error: 'Missing required fields',
        missingFields,
        requiredFields,
        context: { timestamp: requestContext.timestamp }
      }, { status: 400 });
    }

    // Enhanced type validation using Object.hasOwn()
    if (!hasOwnProperty(requestData, 'type') || 
        !['direct', 'entity', 'opportunity'].includes(requestData.type)) {
      return NextResponse.json({
        error: 'Invalid conversation type',
        validTypes: ['direct', 'entity', 'opportunity'],
        context: { timestamp: requestContext.timestamp }
      }, { status: 400 });
    }

    // Enhanced participantIds validation
    if (!hasOwnProperty(requestData, 'participantIds') || 
        !Array.isArray(requestData.participantIds) ||
        requestData.participantIds.length === 0) {
      return NextResponse.json({
        error: 'participantIds must be a non-empty array',
        context: { timestamp: requestContext.timestamp }
      }, { status: 400 });
    }

    // Ensure current user is included in participants
    if (!requestData.participantIds.includes(session.user.id)) {
      requestData.participantIds.push(session.user.id);
    }

    // Enhanced metadata validation using Object.hasOwn()
    if (hasOwnProperty(requestData, 'metadata') && requestData.metadata) {
      if (typeof requestData.metadata !== 'object' || requestData.metadata === null) {
        return NextResponse.json({
          error: 'metadata must be a valid object',
          context: { timestamp: requestContext.timestamp }
        }, { status: 400 });
      }

      // Validate conversation type specific requirements using Object.hasOwn()
      if (requestData.type === 'entity') {
        if (!Object.hasOwn(requestData.metadata, 'entityId') || !requestData.metadata.entityId) {
          return NextResponse.json({
            error: 'entityId is required for entity conversations',
            context: { timestamp: requestContext.timestamp, type: requestData.type }
          }, { status: 400 });
        }
      }

      if (requestData.type === 'opportunity') {
        if (!Object.hasOwn(requestData.metadata, 'opportunityId') || !requestData.metadata.opportunityId) {
          return NextResponse.json({
            error: 'opportunityId is required for opportunity conversations',
            context: { timestamp: requestContext.timestamp, type: requestData.type }
          }, { status: 400 });
        }
      }
    } else if (requestData.type !== 'direct') {
      // For non-direct conversations, metadata is required
      return NextResponse.json({
        error: `metadata is required for ${requestData.type} conversations`,
        context: { timestamp: requestContext.timestamp, type: requestData.type }
      }, { status: 400 });
    }

    // ES2022 logical assignment for enhanced context
    requestContext.conversationType ??= requestData.type;
    requestContext.participantCount ??= requestData.participantIds.length;
    requestContext.hasMetadata ??= !!requestData.metadata;

    console.log('API: /api/conversations POST - Creating conversation:', {
      userId: session.user.id,
      type: requestContext.conversationType,
      participantCount: requestContext.participantCount,
      hasMetadata: requestContext.hasMetadata
    });

    // Create new conversation with enhanced error handling
    const conversation = await conversationService.createConversation(requestData as CreateConversationRequest)

    return NextResponse.json({
      success: true,
      data: conversation,
      metadata: {
        timestamp: requestContext.timestamp,
        created: true
      }
    }, { status: 201 })

  } catch (error) {
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