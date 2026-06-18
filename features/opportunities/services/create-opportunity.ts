/**
 * Create Opportunity Service
 * 
 * Ring-native implementation using DatabaseService
 * MUTATION - NO CACHE! (opportunity creation affects matching/discovery)
 * Uses React 19 revalidatePath() for UI freshness
 */
import { Opportunity, SerializedOpportunity } from '@/features/opportunities/types';
import { auth } from '@/auth';
import { UserRole } from '@/features/auth/types';
import { canCreateOpportunityType } from '@/features/opportunities/lib/opportunity-permissions';
import { assertKnownUserRole } from '@/features/auth/user-role';
import { OpportunityAuthError, OpportunityPermissionError, OpportunityDatabaseError, OpportunityQueryError, logRingError } from '@/lib/errors';
import { validateOpportunityData, validateRequiredFields, hasOwnProperty } from '@/lib/utils';
import { mapDbDocumentToSerializedOpportunity } from '@/features/opportunities/lib/opportunity-db-mapper'
import { syncOpportunityDiscovery } from '@/features/opportunities/lib/opportunity-mutation-sync'
import { appendEvent } from '@/lib/events/event-log.server'
import { Matcher } from '@/lib/ai/matcher'
import { OpportunityAutoFillService } from './auto-fill-service'
import { OpportunityMatchingService } from './matching-service'
import { maybeAutoApproveOpportunity } from './auto-approval-service'
import { logger } from '@/lib/logger';

import { db } from '@/lib/database';

/**
 * Type definition for the data required to create a new opportunity.
 * Excludes 'id', 'dateCreated', and 'dateUpdated' as these are generated server-side.
 */
type NewOpportunityData = Omit<Opportunity, 'id' | 'dateCreated' | 'dateUpdated'>;

/**
 * Creates a new Opportunity with ES2022 enhancements.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and retrieves their session.
 * 2. Validates the user's role and permissions using Object.hasOwn() for safe property checking.
 * 3. Processes the opportunity creation with logical assignment operators for cleaner state management.
 * 4. Returns the created opportunity.
 * 
 * User steps:
 * 1. User must be authenticated before calling this function.
 * 2. User provides the necessary data for creating an opportunity.
 * 3. The function validates the user's permissions and the provided data.
 * 4. If validation passes, the opportunity is created and returned.
 * 
 * @param {NewOpportunityData} data - The data for the new opportunity.
 * @returns {Promise<SerializedOpportunity>} Created opportunity with ISO date fields (PostgreSQL path).
 * @throws {OpportunityAuthError} If user authentication fails
 * @throws {OpportunityPermissionError} If user lacks permission to create opportunities
 * @throws {OpportunityDatabaseError} If database operations fail
 * @throws {OpportunityQueryError} If opportunity creation fails
 */
export async function createOpportunity(data: NewOpportunityData): Promise<SerializedOpportunity> {
  try {
    logger.info('Services: createOpportunity - Starting opportunity creation process...');

    // Step 1: Authenticate the user
    const session = await auth();
    
    if (!session || !session.user) {
      throw new OpportunityAuthError('User authentication required to create opportunity', undefined, {
        timestamp: Date.now(),
        hasSession: !!session,
        hasUser: !!session?.user,
        operation: 'createOpportunity'
      });
    }

    const userId = session.user.id;
    const userRole = assertKnownUserRole(session.user.role);

    // ES2022 Logical Assignment Operators for cleaner validation context
    const validationContext = {
      timestamp: Date.now(),
      operation: 'createOpportunity'
    } as any;
    
    // Use ??= to assign default values only if undefined/null
    validationContext.userId ??= userId;
    validationContext.userRole ??= userRole;
    validationContext.hasSession ??= !!session;
    validationContext.hasUser ??= !!session?.user;

    // Step 2: Enhanced validation with ES2022 Object.hasOwn() and logical operators
    if (!userId) {
      throw new OpportunityAuthError('Valid user ID required to create opportunity', undefined, validationContext);
    }

    // ES2022 Object.hasOwn() for safe property checking on confidential opportunities
    if (Object.hasOwn(data, 'isConfidential') && data.isConfidential) {
      const hasConfidentialAccess =
        userRole === UserRole.admin ||
        userRole === UserRole.superadmin ||
        userRole === UserRole.confidential;

      if (!hasConfidentialAccess) {
        validationContext.requiredRoles &&= [UserRole.admin, UserRole.superadmin, UserRole.confidential];
        throw new OpportunityPermissionError(
          'Only admin, superadmin or confidential users can create confidential opportunities',
          undefined,
          validationContext
        );
      }
    } else {
      const opportunityType = data.type || 'offer';

      if (!canCreateOpportunityType(userRole, opportunityType)) {
        validationContext.opportunityType = opportunityType;
        validationContext.userRole = userRole;
        throw new OpportunityPermissionError(
          `Your role (${userRole}) cannot create ${opportunityType} opportunities`,
          undefined,
          validationContext
        );
      }

      const linkedEntityRequired = new Set([
        'offer',
        'partnership',
        'volunteer',
        'mentorship',
        'resource',
        'event',
      ]);
      if (linkedEntityRequired.has(opportunityType) && !data.contactInfo?.linkedEntity) {
        validationContext.opportunityType = opportunityType;
        throw new OpportunityPermissionError(
          `${opportunityType} opportunities require a linkedEntity in contactInfo`,
          undefined,
          validationContext
        );
      }
    }

    logger.info(`Services: createOpportunity - User authenticated: ${userId} with role: ${userRole}, creating ${data.type || 'offer'} opportunity`);

    // Step 2.5: Enhanced data validation using ES2022 utilities
    if (!validateOpportunityData(data)) {
      throw new OpportunityQueryError('Invalid opportunity data provided', undefined, {
        ...validationContext,
        providedData: data,
        requiredFields: ['title', 'briefDescription']
      });
    }

    // Additional validation using validateRequiredFields and hasOwnProperty
    const requiredFields: (keyof NewOpportunityData)[] = ['title', 'briefDescription'];
    if (!validateRequiredFields(data, requiredFields)) {
      // Fix the missing fields calculation to properly identify undefined/null values
      const missingFields = requiredFields.filter(field => 
        !hasOwnProperty(data, field) || data[field] === null || data[field] === undefined || (typeof data[field] === 'string' && data[field].trim() === '')
      );
      
      throw new OpportunityQueryError('Missing required fields for opportunity creation', undefined, {
        ...validationContext,
        providedData: data,
        requiredFields,
        missingFields
      });
    }

    // Validate optional array fields using hasOwnProperty for safe property checking
    if (hasOwnProperty(data, 'tags') && data.tags) {
      if (!Array.isArray(data.tags)) {
        throw new OpportunityQueryError('Tags must be an array', undefined, {
          ...validationContext,
          providedData: data,
          invalidField: 'tags'
        });
      }
    }

    if (hasOwnProperty(data, 'requiredSkills') && data.requiredSkills) {
      if (!Array.isArray(data.requiredSkills)) {
        throw new OpportunityQueryError('Required skills must be an array', undefined, {
          ...validationContext,
          providedData: data,
          invalidField: 'requiredSkills'
        });
      }
    }

    if (hasOwnProperty(data, 'attachments') && data.attachments) {
      if (!Array.isArray(data.attachments)) {
        throw new OpportunityQueryError('Attachments must be an array', undefined, {
          ...validationContext,
          providedData: data,
          invalidField: 'attachments'
        });
      }
    }

    // Validate budget object using Object.hasOwn() for safe property checking
    if (hasOwnProperty(data, 'budget') && data.budget) {
      if (typeof data.budget !== 'object' || data.budget === null) {
        throw new OpportunityQueryError('Budget must be an object', undefined, {
          ...validationContext,
          providedData: data,
          invalidField: 'budget'
        });
      }
      
      const budgetFields = ['min', 'max', 'currency'] as const;
      const budgetValid = budgetFields.every(field => Object.hasOwn(data.budget, field));
      
      if (!budgetValid) {
        throw new OpportunityQueryError('Budget object missing required fields', undefined, {
          ...validationContext,
          providedData: data,
          invalidField: 'budget',
          requiredBudgetFields: budgetFields,
          missingBudgetFields: budgetFields.filter(field => !Object.hasOwn(data.budget, field))
        });
      }
    }

    // Step 3: Create the new opportunity document with ES2022 logical assignment
    const now = new Date().toISOString()
    const newOpportunityData: any = {
      ...data,
      createdBy: userId,
      dateCreated: now,
      dateUpdated: now,
    };

    // ES2022 ??= logical assignment - set default values if not provided
    newOpportunityData.tags ??= [];
    newOpportunityData.requiredSkills ??= [];
    newOpportunityData.requiredDocuments ??= [];
    newOpportunityData.attachments ??= [];
    newOpportunityData.applicants ??= [];
    
    // ES2022 ||= logical assignment - set defaults for optional fields
    newOpportunityData.isActive ||= true;
    newOpportunityData.isConfidential ||= false;
    
    // Set default values for new tracking fields
    newOpportunityData.applicantCount ??= 0;
    // Priority is optional and only set for certain opportunity types

    // Step 4: Create the opportunity document
    let createdOpportunity: SerializedOpportunity
    try {
      const result = await db().createDoc('opportunities', newOpportunityData)

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to create opportunity');
      }

      createdOpportunity = mapDbDocumentToSerializedOpportunity(result.data)
    } catch (error) {
      throw new OpportunityQueryError(
        'Failed to create opportunity document',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          userId,
          userRole,
          opportunityData: newOpportunityData,
          operation: 'opportunity_creation'
        }
      );
    }

    console.log(`Services: createOpportunity - Opportunity created successfully with ID: ${createdOpportunity.id}`);
    await syncOpportunityDiscovery({
      opportunityId: createdOpportunity.id,
      event: 'created',
    })
    
    // AI-Powered Opportunity Processing: Auto-fill and Matching
    try {
      logger.info('Services: createOpportunity - Starting AI-powered opportunity processing');

      // Step 1: Auto-fill opportunity with AI suggestions
      const autoFillService = new OpportunityAutoFillService();
      const autoFillResult = await autoFillService.enrichOpportunity({
        id: createdOpportunity.id,
        type: createdOpportunity.type,
        title: createdOpportunity.title,
        description: createdOpportunity.briefDescription + (createdOpportunity.fullDescription ? '\n' + createdOpportunity.fullDescription : ''),
        tags: createdOpportunity.tags,
        category: createdOpportunity.category,
        location: createdOpportunity.location,
        budget: createdOpportunity.budget,
        requiredSkills: createdOpportunity.requiredSkills
      });

      logger.info('Services: createOpportunity - Auto-fill completed', {
        confidence: autoFillResult.confidence,
        suggestionsCount: autoFillResult.suggestions.length
      });

      // Step 2: Find matching users and generate notifications
      const matchingService = new OpportunityMatchingService();
      const matchingResult = await matchingService.findMatches(createdOpportunity);

      logger.info('Services: createOpportunity - User matching completed', {
        matchesFound: matchingResult.matches.length,
        averageScore: matchingResult.matchQuality.averageScore,
        processingTime: matchingResult.processingTime
      });

      const approvalResult = await maybeAutoApproveOpportunity(createdOpportunity, matchingResult)
      if (approvalResult.approved) {
        createdOpportunity = {
          ...createdOpportunity,
          status: 'active',
          dateUpdated: new Date().toISOString(),
        }
        logger.info('Services: createOpportunity - Opportunity auto-approved', {
          opportunityId: createdOpportunity.id,
          reason: approvalResult.reason,
        })
      }

      // Step 3: Emit enhanced opportunity_matched event with LLM data
      await appendEvent({
        type: 'opportunity_matched_ai',
        userId,
        reversible: false,
        payload: {
          opportunity: {
            id: createdOpportunity.id,
            title: createdOpportunity.title,
            type: createdOpportunity.type,
            tags: createdOpportunity.tags,
            category: createdOpportunity.category
          },
          autoFillResult,
          matchingResult,
          processingTimestamp: Date.now()
        }
      });

      // Step 4: Notify matched users (async, don't wait for completion)
      if (matchingResult.matches.length > 0) {
        matchingService.notifyMatchedUsers(matchingResult, {
          organizationId: createdOpportunity.organizationId,
        }).catch(error => {
          logger.warn('Services: createOpportunity - User notification failed', { error });
        });
      }

    } catch (error) {
      logger.error('Services: createOpportunity - AI processing failed, continuing without AI features', { error });

      // Fallback: Emit basic opportunity_matched event if AI processing fails
      try {
        const matcher = new Matcher();
        const matches = await matcher.match(createdOpportunity);
        await appendEvent({
          type: 'opportunity_matched',
          userId,
          reversible: false,
          payload: {
            opportunity: {
              id: createdOpportunity.id,
              tags: createdOpportunity.tags,
              type: createdOpportunity.type
            },
            matches,
            fallback: true
          }
        });
      } catch (fallbackError) {
        logger.warn('Services: createOpportunity - Fallback matching also failed', { fallbackError });
      }
    }

    return createdOpportunity;

  } catch (error) {
    // Enhanced error logging with cause information
    logRingError(error, 'Services: createOpportunity - Error creating opportunity');
    
    // Re-throw known errors, wrap unknown errors
    if (error instanceof OpportunityAuthError || 
        error instanceof OpportunityPermissionError ||
        error instanceof OpportunityDatabaseError ||
        error instanceof OpportunityQueryError) {
      throw error;
    }
    
    throw new OpportunityQueryError(
      'Unknown error occurred while creating opportunity',
      error instanceof Error ? error : new Error(String(error)),
      {
        timestamp: Date.now(),
        operation: 'createOpportunity'
      }
    );
  }
}

