// Service to fetch opportunities created by or applied to by a specific user
// Following Ring Platform architecture patterns from SYSTEM-ARCHITECTURE.md

import { QuerySnapshot } from 'firebase-admin/firestore';
import { Opportunity, SerializedOpportunity } from '@/features/opportunities/types';
import { UserRole } from '@/features/auth/types';
import { auth } from '@/auth';
import { OpportunityAuthError, OpportunityPermissionError, OpportunityQueryError, logRingError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { 
  getCachedCollectionAdvanced,
  getCachedDocument
} from '@/lib/services/firebase-service-manager';

/**
 * Fetches opportunities created by a specific user
 * Following the dual-nature opportunity system from PLATFORM-PHILOSOPHY.md
 * 
 * @param userId - The ID of the user whose opportunities to fetch
 * @param limit - Maximum number of opportunities to return
 * @param startAfter - Document ID for pagination
 * @returns Promise with user's opportunities and pagination info
 */
export async function getUserCreatedOpportunities(
  userId: string,
  limit: number = 20,
  startAfter?: string
): Promise<{ opportunities: SerializedOpportunity[]; lastVisible: string | null }> {
  try {
    logger.info('Services: getUserCreatedOpportunities - Starting...', { userId, limit, startAfter });

    // Build query for opportunities created by this user
    const queryConfig: any = {
      where: [{ field: 'createdBy', operator: '==', value: userId }],
      orderBy: [{ field: 'dateCreated', direction: 'desc' }],
      limit
    };

    // Apply pagination if provided
    if (startAfter) {
      try {
        const startAfterDoc = await getCachedDocument('opportunities', startAfter);
        if (startAfterDoc && startAfterDoc.exists) {
          queryConfig.startAfter = startAfterDoc;
        }
      } catch (error) {
        logger.warn('Pagination document not found, starting from beginning');
      }
    }

    // Execute query
    const snapshot = await getCachedCollectionAdvanced('opportunities', queryConfig);

    // Map and serialize opportunities
    const opportunities = snapshot.docs.map(doc => {
      const data = doc.data();
      
      const timestampToISO = (timestamp: any): string => {
        if (timestamp && typeof timestamp.toDate === 'function') {
          return timestamp.toDate().toISOString();
        }
        if (timestamp instanceof Date) {
          return timestamp.toISOString();
        }
        return new Date().toISOString();
      };
      
      return {
        ...data,
        id: doc.id,
        dateCreated: timestampToISO(data.dateCreated),
        dateUpdated: timestampToISO(data.dateUpdated),
        expirationDate: timestampToISO(data.expirationDate),
        applicationDeadline: data.applicationDeadline ? timestampToISO(data.applicationDeadline) : undefined,
      } as SerializedOpportunity;
    });

    const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null;

    logger.info('Services: getUserCreatedOpportunities - Fetched', { count: opportunities.length, lastVisible });

    return { opportunities, lastVisible };
  } catch (error) {
    logRingError(error, 'Services: getUserCreatedOpportunities - Error');
    throw new OpportunityQueryError(
      'Failed to fetch user opportunities',
      error instanceof Error ? error : new Error(String(error)),
      {
        timestamp: Date.now(),
        userId,
        operation: 'getUserCreatedOpportunities'
      }
    );
  }
}

/**
 * Fetches opportunities the user has applied to
 * This would require tracking applications in a separate collection
 * For now, returns empty array as placeholder
 */
export async function getUserAppliedOpportunities(
  userId: string,
  limit: number = 20,
  startAfter?: string
): Promise<{ opportunities: SerializedOpportunity[]; lastVisible: string | null }> {
  // TODO: Implement when applications tracking is added
  logger.info('Services: getUserAppliedOpportunities - Not yet implemented');
  return { opportunities: [], lastVisible: null };
}

/**
 * Combined function to get all user's opportunities (created + applied)
 * Follows the professional mapping paradigm from PLATFORM-PHILOSOPHY.md
 */
export async function getMyOpportunities(
  filterType: 'all' | 'created' | 'applied' = 'all',
  limit: number = 20,
  startAfter?: string
): Promise<{ opportunities: SerializedOpportunity[]; lastVisible: string | null; counts: { created: number; applied: number } }> {
  const session = await auth();
  
  if (!session || !session.user) {
    throw new OpportunityAuthError('Authentication required', undefined, {
      timestamp: Date.now(),
      operation: 'getMyOpportunities'
    });
  }

  const userId = session.user.id;

  try {
    let opportunities: SerializedOpportunity[] = [];
    let lastVisible: string | null = null;

    if (filterType === 'all' || filterType === 'created') {
      const created = await getUserCreatedOpportunities(userId, limit, startAfter);
      opportunities = created.opportunities;
      lastVisible = created.lastVisible;
    }

    if (filterType === 'applied') {
      const applied = await getUserAppliedOpportunities(userId, limit, startAfter);
      opportunities = applied.opportunities;
      lastVisible = applied.lastVisible;
    }

    // Get counts for UI display
    const createdCount = filterType === 'created' || filterType === 'all' 
      ? opportunities.filter(o => o.createdBy === userId).length 
      : 0;
    const appliedCount = 0; // TODO: Implement when applications tracking is added

    return { 
      opportunities, 
      lastVisible,
      counts: {
        created: createdCount,
        applied: appliedCount
      }
    };
  } catch (error) {
    logRingError(error, 'Services: getMyOpportunities - Error');
    throw error;
  }
}
