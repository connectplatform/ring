import { NextRequest, NextResponse, connection} from 'next/server';
import { auth } from '@/auth';
import { createEntity } from '@/features/entities/services/create-entity';
import { Entity } from '@/features/entities/types';
import { z } from 'zod';
import { rateLimit, keyFromRequest } from '@/lib/rate-limit';
import { isFeatureEnabledOnServer } from '@/whitelabel/features'

/**
 * Handles POST requests for creating new entities.
 * 
 * This route allows authenticated users to create new entities.
 * It expects the entity data in the request body.
 * 
 * User steps:
 * 1. Authenticate with the application.
 * 2. Prepare the entity data.
 * 3. Send a POST request to this route with the entity data in the body.
 * 4. Receive a JSON response with the created entity or an error message.
 * 
 * @param {NextRequest} req - Incoming request object from Next.js.
 * @returns {Promise<NextResponse>} Response object containing the created entity or an error message.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  await connection() // Next.js 16: opt out of prerendering

  const { logger } = await import('@/lib/logger')
  logger.info('api.entities.create.start')

  try {
    if (!isFeatureEnabledOnServer('entities')) {
      return NextResponse.json({ error: 'Feature disabled' }, { status: 404 })
    }
    // Authenticate and obtain user's session
    const session = await auth();
    // Rate limit per user/IP
    const key = keyFromRequest(req as any, session.user.id)
    const rl = rateLimit(key, 30, 60_000)
    if (!rl.ok) {
      return NextResponse.json({ error: 'Rate limit exceeded', resetAt: rl.resetAt }, { status: 429 })
    }


    // Check if the session and user exist
    if (!session || !session.user) {
      logger.warn('api.entities.create.unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate the request body
    const schema = z.object({
      name: z.string().min(1),
      type: z.string().min(1),
      shortDescription: z.string().min(1),
      visibility: z.enum(['public', 'subscriber', 'member', 'confidential']).optional(),
      isConfidential: z.boolean().optional(),
    }).passthrough();

    let data: Omit<Entity, 'id' | 'onlineStatus' | 'lastOnline'>;
    try {
      data = schema.parse(await req.json()) as any;
      logger.debug('api.entities.create.body.parsed')
    } catch (error) {
      console.error('API: /api/entities/create - Invalid body:', error);
      return NextResponse.json({ error: 'Invalid entity data' }, { status: 400 });
    }

    // Create the new entity
    const newEntity = await createEntity(data);
    logger.info('api.entities.create.success', { entityId: newEntity.id })

    return NextResponse.json(newEntity, { status: 201 });
  } catch (error) {
    logger.error('api.entities.create.error', { error: error instanceof Error ? error.message : String(error) })
    if (error instanceof Error) {
      // Handle specific errors
      if (error.message.includes('Only ADMIN or CONFIDENTIAL users')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Only ADMIN, MEMBER, or CONFIDENTIAL users')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      // Log any other known errors
      console.error('API: /api/entities/create - Error details:', error.message);
    }
    // Return a generic internal server error for unexpected cases
    return NextResponse.json({ error: 'Failed to create entity: Internal Server Error' }, { status: 500 });
  }
}

/**
 * Prevent caching for this route
 */

