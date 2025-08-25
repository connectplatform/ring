import { NextRequest, NextResponse } from 'next/server';
import { createOpportunity } from '@/features/opportunities/services/create-opportunity';
import { auth } from '@/auth'; // Auth.js handler for session
import { UserRole } from '@/features/auth/types';
import { Opportunity } from '@/features/opportunities/types';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { z } from 'zod';
import { logger } from '@/lib/logger'
import { rateLimit, keyFromRequest } from '@/lib/rate-limit';
import { isFeatureEnabledOnServer } from '@/whitelabel/features'

const createOpportunitySchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  budget: z.object({ min: z.number().nonnegative(), max: z.number().nonnegative(), currency: z.string().min(1) }),
  expirationDate: z.string().or(z.date()).optional(),
  visibility: z.enum(['public', 'subscriber', 'member', 'confidential']).optional(),
  isConfidential: z.boolean().optional(),
  requiredDocuments: z.array(z.any()).optional(),
  attachments: z.array(z.any()).optional(),
  contactInfo: z.any().optional(),
  fullDescription: z.string().optional(),
  type: z.enum(['offer', 'request']).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  location: z.string().optional()
})

/**
 * POST handler for creating a new opportunity
 * 
 * This API route handles the creation of new opportunities. It performs the following steps:
 * 1. Authenticates the user
 * 2. Checks user permissions
 * 3. Validates and processes the incoming data
 * 4. Creates the opportunity using the opportunity service
 * 5. Returns the created opportunity or an error response
 */

export async function POST(req: NextRequest) {
    logger.info('api.opportunities.create.start')

  try {
    if (!isFeatureEnabledOnServer('opportunities')) {
      return NextResponse.json({ error: 'Feature disabled' }, { status: 404 })
    }
    // Step 1: Authenticate the user
    const session = await auth();
    // Rate limit per user/IP
    const key = keyFromRequest(req as any, session.user.id)
    const rl = rateLimit(key, 30, 60_000)
    if (!rl.ok) {
      return NextResponse.json({ error: 'Rate limit exceeded', resetAt: rl.resetAt }, { status: 429 })
    }

    if (!session || !session.user) {
      console.log('API: /api/opportunities/create - Unauthorized access attempt');
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Step 2: Check user permissions
    const userRole = session.user.role as UserRole;
    const userId = session.user.id;

    logger.info('api.opportunities.create.auth', { userId, role: userRole })

    if (![UserRole.MEMBER, UserRole.CONFIDENTIAL, UserRole.ADMIN].includes(userRole)) {
      console.log('API: /api/opportunities/create - Access denied for user', { userId, role: userRole });
      return NextResponse.json({ error: 'Access denied. Insufficient permissions to create an opportunity.' }, { status: 403 });
    }

    // Step 3: Validate and process the incoming data
    const data = createOpportunitySchema.parse(await req.json());
    
    // Data already validated above

    // Step 4: Create the opportunity
    logger.info('api.opportunities.create.create', { userId })
    const opportunityData: any = {
      ...data,
      // Fill required fields that service layer expects
      type: (data as any).type || 'offer',
      category: (data as any).category || 'general',
      tags: (data as any).tags || [],
      location: (data as any).location || 'remote',
      requiredSkills: (data as any).requiredSkills || [],
      description: (data as any).description || '',
      organizationId: (data as any).organizationId || '',

      createdBy: userId,
      isConfidential: data.visibility === 'confidential',
      dateCreated: serverTimestamp(),
      dateUpdated: serverTimestamp(),
      expirationDate: data.expirationDate ? Timestamp.fromDate(new Date(data.expirationDate as any)) : serverTimestamp(),
      status: 'active' as const, // Default status for a new opportunity
      requiredDocuments: (data as any).requiredDocuments || [],
      attachments: (data as any).attachments || [],
      contactInfo: {
        linkedEntity: (data as any).linkedEntity || '',
        contactAccount: (data as any).contactAccount || '',
      },
    };
    const opportunity: Opportunity = await createOpportunity(opportunityData);

    // Step 5: Return the created opportunity
    logger.info('api.opportunities.create.success', { opportunityId: opportunity.id })
    return NextResponse.json(opportunity, { status: 201 });

  } catch (error) {
    // Error handling
    console.error('API: /api/opportunities/create - Error occurred:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('permission-denied')) {
        return NextResponse.json({ error: 'Permission denied to create opportunity' }, { status: 403 });
      }
    }

    return NextResponse.json({ error: 'Failed to create opportunity. Please try again later.' }, { status: 500 });
  }
}

/**
 * Prevent caching for this route
 * This is important in Next.js 15 as the default caching behavior has changed
 */
export const dynamic = 'force-dynamic';

/**
 * Configuration for the API route
 */
export const config = {
  runtime: 'nodejs',
};