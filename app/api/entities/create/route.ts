import { NextRequest, NextResponse, connection } from 'next/server';
import { auth } from '@/auth';
import { createEntity } from '@/features/entities/services/create-entity';
import { Entity } from '@/features/entities/types';
import { z } from 'zod';
import { rateLimit, keyFromRequest } from '@/lib/rate-limit';
import { isFeatureEnabledOnServer } from '@/whitelabel/features'

// TODO: Switch to Next.js 16 middleware and route handlers for better opt-out/in of caching & API control when mature.

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
  // Opt out of prerendering/static rendering for this API route, ensures every request hits the server (Next.js 16+)
  await connection();

  // Dynamically import logger for logging throughout the route
  const { logger } = await import('@/lib/logger');
  logger.info('api.entities.create.start');

  try {
    // Check if 'entities' feature is enabled server-side (feature-flag, whitelabeling)
    if (!isFeatureEnabledOnServer('entities')) {
      return NextResponse.json({ error: 'Feature disabled' }, { status: 404 });
    }

    // Authenticate the current user and fetch their session
    const session = await auth();

    // TODO: With Next.js 16, consider leveraging new middleware/session primitives if available

    // Perform rate limiting: key is derived from user + IP
    const key = keyFromRequest(req as any, session?.user?.id);
    const rl = rateLimit(key, 30, 60_000); // max 30 requests per 60 seconds
    if (!rl.ok) {
      // Rate limit exceeded
      return NextResponse.json(
        { error: 'Rate limit exceeded', resetAt: rl.resetAt },
        { status: 429 }
      );
    }

    // Ensure session and user are set after authentication
    if (!session || !session.user) {
      logger.warn('api.entities.create.unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Define validation schema for incoming request body using Zod.
    // Allows additional properties (passthrough) instead of strict validation.
    const schema = z.object({
      name: z.string().min(1), // At least 1 character, required
      type: z.string().min(1), // At least 1 character, required
      shortDescription: z.string().min(1), // At least 1 character, required
      visibility: z.enum(['public', 'subscriber', 'member', 'confidential']).optional(), // Optional
      isConfidential: z.boolean().optional(), // Optional
    }).passthrough();

    let data: Omit<Entity, 'id' | 'onlineStatus' | 'lastOnline'>;
    try {
      // Parse and validate the incoming request body as JSON against the schema
      data = schema.parse(await req.json()) as any;
      logger.debug('api.entities.create.body.parsed');
    } catch (error) {
      // Invalid body: Zod validation failed or json() issue
      console.error('API: /api/entities/create - Invalid body:', error);
      return NextResponse.json({ error: 'Invalid entity data' }, { status: 400 });
    }

    // TODO: If validation gets complicated, consider extracting validation to a shared utils module.

    // Attempt to create the new entity in the datastore/service
    const newEntity = await createEntity(data);
    logger.info('api.entities.create.success', { entityId: newEntity.id });

    // Return the successfully created entity (201 Created)
    return NextResponse.json(newEntity, { status: 201 });

  } catch (error) {
    // Global error handler: log error, respond appropriately
    logger.error('api.entities.create.error', {
      error: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof Error) {
      // Special-case error messages indicating insufficient permission, return 403
      if (error.message.includes('Only admin or confidential users')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Only admin, member, or confidential users')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      // Log known errors (catch-alls or operational errors)
      console.error('API: /api/entities/create - Error details:', error.message);
    }
    // Fallback for unhandled/unknown runtime errors: respond with 500
    return NextResponse.json(
      { error: 'Failed to create entity: Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * Prevent caching for this route
 */
// TODO: Explicitly disable caching (e.g. set cache-control headers) with new Next.js APIs when available/needed.
