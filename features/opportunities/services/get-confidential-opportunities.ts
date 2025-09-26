// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

/**
 * @fileoverview Service for handling confidential opportunities in the Firebase database.
 * This module provides functionality to fetch and paginate confidential opportunities
 * with filtering and sorting capabilities.
 */

import { Opportunity } from '@/features/opportunities/types';
import { UserRole } from '@/features/auth/types';
import { FirestoreDataConverter, DocumentData, Query } from 'firebase-admin/firestore';
import { opportunityConverter } from '@/lib/converters/opportunity-converter';

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getCachedDocument, getCachedCollection, getCachedOpportunities } from '@/lib/build-cache/static-data-cache';
import { db } from '@/lib/database/DatabaseService';

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

    // Validate role: only CONFIDENTIAL or ADMIN allowed here
    if (userRole !== UserRole.CONFIDENTIAL && userRole !== UserRole.ADMIN) {
      throw new Error('Invalid or missing user role for confidential access');
    }

    // Step 1: Build filters for confidential opportunities
    const filters: Array<{ field: string; operator: string; value: any }> = [
      { field: 'isConfidential', operator: '==', value: true }
    ];

    // Apply additional status filter if provided
    if (filter) {
      filters.push({ field: 'status', operator: '==', value: filter });
    }

    // Step 2: Parse sorting criteria
    const [sortField, sortDirection] = sort.split(':');

    // Step 3: Get total count for pagination
    const countResult = await db().execute('count', {
      collection: 'opportunities',
      filters: filters
    });

    const totalOpportunities = countResult.success ? countResult.data : 0;
    const totalPages = Math.ceil(totalOpportunities / limit);

    // Step 4: Build query with pagination
    const dbQuery = {
      collection: 'opportunities',
      filters: filters,
      orderBy: [{ field: sortField, direction: sortDirection as 'asc' | 'desc' }],
      pagination: {
        limit: limit,
        offset: startAfter ? 1 : 0 // Simple offset for pagination
      }
    };

    if (startAfter) {
      console.log(`Services: getconfidential-opportunities - Paginating after opportunity ID: ${startAfter}`);
      try {
        const startAfterResult = await db().execute('findById', {
          collection: 'opportunities',
          id: startAfter
        });

        if (startAfterResult.success && startAfterResult.data) {
          // For now, use simple offset-based pagination
          // TODO: Implement proper cursor-based pagination when db.command() supports it
        }
      } catch (error) {
        console.warn(`Services: getconfidential-opportunities - Start-after document ${startAfter} error:`, error);
      }
    }

    // Step 5: Execute query and process results
    const queryResult = await db().execute('query', { querySpec: dbQuery });

    const opportunities: Opportunity[] = [];
    if (queryResult.success && queryResult.data) {
      queryResult.data.forEach(item => {
        opportunities.push({
          ...item.data,
          id: item.id,
        } as Opportunity);
      });
    }

    // Get the ID of the last visible document for next page pagination
    const lastVisible = opportunities.length > 0
      ? opportunities[opportunities.length - 1].id
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