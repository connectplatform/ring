/**
 * @fileoverview Service for handling confidential opportunities in the Firebase database.
 * This module provides functionality to fetch and paginate confidential opportunities
 * with filtering and sorting capabilities.
 */

import { getAdminDb } from '@/lib/firebase-admin.server';
import { Opportunity } from '@/types';
import { UserRole } from '@/features/auth/types';
import { FirestoreDataConverter, DocumentData, Query } from 'firebase-admin/firestore';
import { opportunityConverter } from '@/lib/converters/opportunity-converter';

/**
 * Interface defining the parameters required to fetch confidential opportunities
 * @interface Getconfidential-opportunitiesParams
 * @property {number} page - Current page number for pagination
 * @property {number} limit - Number of records to return per page
 * @property {string} sort - Sorting criteria in format 'field:direction' (e.g., 'createdAt:desc')
 * @property {string} filter - Filter criteria for opportunity status
 * @property {string} [startAfter] - Optional document ID to start pagination after
 * @property {string} userId - ID of the user making the request
 * @property {UserRole.CONFIDENTIAL | UserRole.ADMIN} userRole - Role of the requesting user
 */
interface getConfidentialOpportunitiesParams {
  page: number;
  limit: number;
  sort: string;
  filter: string;
  startAfter?: string;
  userId: string;
  userRole: UserRole.CONFIDENTIAL | UserRole.ADMIN;
}

/**
 * Interface defining the structure of the response when fetching confidential opportunities
 * @interface getConfidentialOpportunitiesResult
 * @property {Opportunity[]} opportunities - Array of fetched opportunities
 * @property {string | null} lastVisible - ID of the last document in current page, used for pagination
 * @property {number} totalPages - Total number of available pages
 * @property {number} totalOpportunities - Total count of matching opportunities
 */
interface getConfidentialOpportunitiesResult {
  opportunities: Opportunity[];
  lastVisible: string | null;
  totalPages: number;
  totalOpportunities: number;
}

/**
 * Fetches confidential opportunities from Firestore with pagination, sorting, and filtering
 * 
 * Usage example:
 * ```typescript
 * const result = await getconfidential-opportunities({
 *   page: 1,
 *   limit: 10,
 *   sort: 'createdAt:desc',
 *   filter: 'active',
 *   userId: 'user123',
 *   userRole: UserRole.CONFIDENTIAL
 * });
 * ```
 * 
 * User flow:
 * 1. User requests confidential opportunities with specific criteria
 * 2. System validates user has appropriate role (CONFIDENTIAL or ADMIN)
 * 3. System fetches opportunities matching criteria with pagination
 * 4. System returns formatted results with pagination metadata
 * 
 * @param {getConfidentialOpportunitiesParams} params - Parameters for fetching opportunities
 * @returns {Promise<getConfidentialOpportunitiesResult>} Paginated opportunities and metadata
 * @throws {Error} If database operation fails or parameters are invalid
 */
export async function getConfidentialOpportunities(
  params: getConfidentialOpportunitiesParams
): Promise<getConfidentialOpportunitiesResult> {
  try {
    console.log('Services: getconfidential-opportunities - Starting...', params);
    const { limit, startAfter, sort, filter, userRole } = params;

    // Step 1: Initialize Firestore using admin SDK
    // Uses admin SDK to ensure proper access controls and server-side execution
    const adminDb = getAdminDb();
    const opportunitiesCol = adminDb
      .collection('opportunities')
      .withConverter(opportunityConverter as FirestoreDataConverter<Opportunity>);

    // Step 2: Build base query for confidential opportunities
    // Filters for confidential opportunities only
    let baseQuery = opportunitiesCol.where('isConfidential', '==', true);

    // Apply additional status filter if provided
    // Allows filtering by opportunity status (e.g., 'active', 'closed')
    if (filter) {
      baseQuery = baseQuery.where('status', '==', filter);
    }

    // Apply sorting based on provided criteria
    // Expects sort parameter in format 'field:direction' (e.g., 'createdAt:desc')
    const [sortField, sortDirection] = sort.split(':');
    baseQuery = baseQuery.orderBy(sortField, sortDirection as 'asc' | 'desc');

    // Step 3: Get total count for pagination
    // Calculates total pages and opportunities for pagination metadata
    const totalSnapshot = await baseQuery.count().get();
    const totalOpportunities = totalSnapshot.data().count;
    const totalPages = Math.ceil(totalOpportunities / limit);

    // Step 4: Build paginated query
    // Implements cursor-based pagination using startAfter parameter
    let query: Query<Opportunity> = baseQuery.limit(limit);
    if (startAfter) {
      console.log(`Services: getconfidential-opportunities - Paginating after opportunity ID: ${startAfter}`);
      const startAfterDoc = await opportunitiesCol.doc(startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      } else {
        console.warn(`Services: getconfidential-opportunities - Start-after document ${startAfter} does not exist`);
      }
    }

    // Step 5: Execute query and process results
    // Fetches documents and formats them for response
    const querySnapshot = await query.get();
    const opportunities = querySnapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }));

    // Get the ID of the last visible document for next page pagination
    const lastVisible = querySnapshot.docs.length > 0
      ? querySnapshot.docs[querySnapshot.docs.length - 1].id
      : null;

    console.log('Services: getconfidential-opportunities - Results:', {
      opportunitiesCount: opportunities.length,
      totalOpportunities,
      totalPages,
      lastVisible
    });

    return {
      opportunities,
      lastVisible,
      totalPages,
      totalOpportunities
    };

  } catch (error) {
    console.error('Services: getconfidential-opportunities - Error:', error);
    throw error instanceof Error
      ? error
      : new Error('Unknown error occurred while fetching confidential opportunities');
  }
}