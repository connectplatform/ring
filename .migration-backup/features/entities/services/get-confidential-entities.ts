import { getAdminDb } from '@/lib/firebase-admin.server';
import { Entity } from '@/features/entities/types';
import { UserRole } from '@/features/auth/types';
import { auth } from '@/auth';
import { QuerySnapshot, Query, DocumentSnapshot } from 'firebase-admin/firestore';
import { entityConverter } from '@/lib/converters/entity-converter';

interface getConfidentialEntitiesParams {
  page: number;
  limit: number;
  sort: string;
  filter: string;
  startAfter?: string;
  userId: string;
  userRole: UserRole.CONFIDENTIAL | UserRole.ADMIN;
}

interface getConfidentialEntitiesResult {
  entities: Entity[];
  lastVisible: string | null;
  totalPages: number;
  totalEntities: number;
}

export async function getConfidentialEntities(
  params: getConfidentialEntitiesParams
): Promise<getConfidentialEntitiesResult> {
  try {
    console.log('Services: getConfidentialEntities - Starting...', params);

    const { limit, startAfter, sort, filter, userRole } = params;

    // Validate role: only CONFIDENTIAL or ADMIN allowed here
    if (userRole !== UserRole.CONFIDENTIAL && userRole !== UserRole.ADMIN) {
      throw new Error('Invalid or missing user role for confidential access');
    }

    // Step 1: Access Firestore and initialize collection with converter
    const adminDb = await getAdminDb();
    const entitiesCollection = adminDb.collection('entities').withConverter(entityConverter);

    // Step 2: Build the base query for confidential entities
    let baseQuery = entitiesCollection.where('isConfidential', '==', true);

    // Apply filter if provided
    if (filter) {
      baseQuery = baseQuery.where('status', '==', filter);
    }

    // Apply sorting
    const [sortField, sortDirection] = sort.split(':');
    baseQuery = baseQuery.orderBy(sortField, sortDirection as 'asc' | 'desc');

    // Step 3: Get total count for pagination
    const totalSnapshot = await baseQuery.count().get();
    const totalEntities = totalSnapshot.data().count;
    const totalPages = Math.ceil(totalEntities / limit);

    // Step 4: Build the paginated query
    let query: Query<Entity> = baseQuery.limit(limit);

    if (startAfter) {
      console.log(`Services: getConfidentialEntities - Paginating after entity ID: ${startAfter}`);
      const startAfterDoc = await entitiesCollection.doc(startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      } else {
        console.warn(`Services: getConfidentialEntities - Start-after document ${startAfter} does not exist`);
      }
    }

    // Step 5: Execute the query and process results
    const snapshot: QuerySnapshot<Entity> = await query.get();

    const entities: Entity[] = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    }));

    const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null;

    console.log('Services: getConfidentialEntities - Results:', {
      entitiesCount: entities.length,
      totalEntities,
      totalPages,
      lastVisible
    });

    return {
      entities,
      lastVisible,
      totalPages,
      totalEntities
    };
  } catch (error) {
    console.error('Services: getConfidentialEntities - Error:', error);
    throw error instanceof Error 
      ? error 
      : new Error('Unknown error occurred while fetching confidential entities');
  }
}