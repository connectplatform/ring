import { NextRequest, NextResponse } from 'next/server';
import { createOpportunity } from '@/services/opportunities/create-opportunity';
import { auth } from '@/auth'; // Auth.js handler for session
import { UserRole } from '@/features/auth/types';
import { Opportunity } from '@/features/opportunities/types';
import { serverTimestamp, Timestamp } from 'firebase/firestore';

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
  console.log('API: /api/opportunities/create - Starting POST request');

  try {
    // Step 1: Authenticate the user
    const session = await auth();
    if (!session || !session.user) {
      console.log('API: /api/opportunities/create - Unauthorized access attempt');
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Step 2: Check user permissions
    const userRole = session.user.role as UserRole;
    const userId = session.user.id;

    console.log('API: /api/opportunities/create - User authenticated', { userId, role: userRole });

    if (![UserRole.MEMBER, UserRole.CONFIDENTIAL, UserRole.ADMIN].includes(userRole)) {
      console.log('API: /api/opportunities/create - Access denied for user', { userId, role: userRole });
      return NextResponse.json({ error: 'Access denied. Insufficient permissions to create an opportunity.' }, { status: 403 });
    }

    // Step 3: Validate and process the incoming data
    const data = await req.json();
    
    if (!data.title || !data.description) {
      console.log('API: /api/opportunities/create - Invalid data provided', { data });
      return NextResponse.json({ error: 'Invalid opportunity data. Title and description are required.' }, { status: 400 });
    }

    // Step 4: Create the opportunity
    console.log('API: /api/opportunities/create - Creating opportunity', { userId, data });
    const opportunityData = {
      ...data,
      createdBy: userId,
      isConfidential: data.visibility === 'confidential',
      dateCreated: serverTimestamp(),
      dateUpdated: serverTimestamp(),
      expirationDate: data.expirationDate ? Timestamp.fromDate(new Date(data.expirationDate)) : null,
      status: 'active' as const, // Default status for a new opportunity
      requiredDocuments: data.requiredDocuments || [],
      attachments: data.attachments || [],
      contactInfo: {
        linkedEntity: data.linkedEntity || '',
        contactAccount: data.contactAccount || '',
      },
    };
    const opportunity: Opportunity = await createOpportunity(opportunityData);

    // Step 5: Return the created opportunity
    console.log('API: /api/opportunities/create - Opportunity created successfully', { opportunityId: opportunity.id });
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