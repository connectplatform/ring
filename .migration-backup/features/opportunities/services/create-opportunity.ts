import { getAdminDb } from '@/lib/firebase-admin.server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Opportunity } from '@/features/opportunities/types';
import { getServerAuthSession } from '@/auth';
import { UserRole } from '@/features/auth/types';
import { opportunityConverter } from '@/lib/converters/opportunity-converter';
import { OpportunityAuthError, OpportunityPermissionError, OpportunityDatabaseError, OpportunityQueryError, logRingError } from '@/lib/errors';
import { validateOpportunityData, validateRequiredFields, hasOwnProperty } from '@/lib/utils';
import { invalidateOpportunitiesCache } from '@/lib/cached-data'
import { appendEvent } from '@/lib/events/event-log'
import { NeuralMatcher } from '@/lib/ai/neural-matcher'

/**
 * Type definition for the data required to create a new opportunity.
 * Excludes 'id', 'dateCreated', and 'dateUpdated' as these are generated server-side.
 */
type NewOpportunityData = Omit<Opportunity, 'id' | 'dateCreated' | 'dateUpdated'>;

/**
 * Creates a new Opportunity in Firestore with ES2022 enhancements.
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
 * @returns {Promise<Opportunity>} A promise that resolves to the created Opportunity object, including its generated ID.
 * @throws {OpportunityAuthError} If user authentication fails
 * @throws {OpportunityPermissionError} If user lacks permission to create opportunities
 * @throws {OpportunityDatabaseError} If database operations fail
 * @throws {OpportunityQueryError} If opportunity creation fails
 */
export async function createOpportunity(data: NewOpportunityData): Promise<Opportunity> {
  try {
    console.log('Services: createOpportunity - Starting opportunity creation process...');

    // Step 1: Authenticate the user
    const session = await getServerAuthSession();
    
    if (!session || !session.user) {
      throw new OpportunityAuthError('User authentication required to create opportunity', undefined, {
        timestamp: Date.now(),
        hasSession: !!session,
        hasUser: !!session?.user,
        operation: 'createOpportunity'
      });
    }

    const userId = session.user.id;
    const userRole = session.user.role as UserRole;

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
      const hasConfidentialAccess = userRole === UserRole.ADMIN || userRole === UserRole.CONFIDENTIAL;
      
      if (!hasConfidentialAccess) {
        // Use &&= for conditional assignment
        validationContext.requiredRoles &&= [UserRole.ADMIN, UserRole.CONFIDENTIAL];
        throw new OpportunityPermissionError(
          'Only ADMIN or CONFIDENTIAL users can create confidential opportunities',
          undefined,
          validationContext
        );
      }
    } else {
      // Use logical OR for multiple role checking
      const hasOpportunityAccess = [UserRole.MEMBER, UserRole.ADMIN, UserRole.CONFIDENTIAL].includes(userRole);
      
      if (!hasOpportunityAccess) {
        validationContext.requiredRoles ??= [UserRole.MEMBER, UserRole.ADMIN, UserRole.CONFIDENTIAL];
        throw new OpportunityPermissionError(
          'Only MEMBER, ADMIN, or CONFIDENTIAL users can create opportunities',
          undefined,
          validationContext
        );
      }
    }

    console.log(`Services: createOpportunity - User authenticated: ${userId} with role: ${userRole}`);

    // Step 2.5: Enhanced data validation using ES2022 utilities
    if (!validateOpportunityData(data)) {
      throw new OpportunityQueryError('Invalid opportunity data provided', undefined, {
        ...validationContext,
        providedData: data,
        requiredFields: ['title', 'briefDescription', 'budget', 'expirationDate']
      });
    }

    // Additional validation using validateRequiredFields and hasOwnProperty
    const requiredFields: (keyof NewOpportunityData)[] = ['title', 'briefDescription', 'budget', 'expirationDate'];
    if (!validateRequiredFields(data, requiredFields)) {
      throw new OpportunityQueryError('Missing required fields for opportunity creation', undefined, {
        ...validationContext,
        providedData: data,
        requiredFields,
        missingFields: requiredFields.filter(field => !hasOwnProperty(data, field))
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

    // Step 3: Initialize database connection
    let adminDb;
    const dbContext = { ...validationContext, operation: 'getAdminDb' };
    
    try {
      adminDb = await getAdminDb();
    } catch (error) {
      throw new OpportunityDatabaseError(
        'Failed to initialize database connection',
        error instanceof Error ? error : new Error(String(error)),
        dbContext
      );
    }

    const opportunitiesCollection = adminDb.collection('opportunities').withConverter(opportunityConverter);

    // Step 4: Create the new opportunity document with ES2022 logical assignment
    const newOpportunityData: any = {
      ...data,
      createdBy: userId,
      dateCreated: FieldValue.serverTimestamp(),
      dateUpdated: FieldValue.serverTimestamp(),
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

    let docRef;
    try {
      docRef = await opportunitiesCollection.add(newOpportunityData);
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

    // Step 5: Retrieve the created opportunity
    let docSnap;
    try {
      docSnap = await docRef.get();
    } catch (error) {
      throw new OpportunityQueryError(
        'Failed to retrieve created opportunity',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          userId,
          userRole,
          opportunityId: docRef.id,
          operation: 'opportunity_retrieval'
        }
      );
    }

    if (!docSnap.exists) {
      throw new OpportunityQueryError(
        'Created opportunity document not found',
        undefined,
        {
          timestamp: Date.now(),
          userId,
          userRole,
          opportunityId: docRef.id,
          operation: 'opportunity_verification'
        }
      );
    }

    // Step 6: Retrieve and return the created opportunity
    const opportunityData = {
      ...docSnap.data(),
      id: docSnap.id,
      dateCreated: docSnap.createTime || Timestamp.now(),
      dateUpdated: docSnap.updateTime || Timestamp.now(),
    };

    let createdOpportunity;
    try {
      createdOpportunity = opportunityConverter.fromFirestore({
        ...docSnap,
        data: () => opportunityData,
      } as any);
    } catch (error) {
      throw new OpportunityQueryError(
        'Failed to convert opportunity document',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          userId,
          userRole,
          opportunityId: docRef.id,
          operation: 'opportunity_conversion'
        }
      );
    }

    console.log(`Services: createOpportunity - Opportunity created successfully with ID: ${docRef.id}`);
    invalidateOpportunitiesCache(['public','subscriber','member','confidential','admin'])
    
    // Emit opportunity_matched baseline event(s) using NeuralMatcher
    try {
      const matcher = new NeuralMatcher()
      const matches = await matcher.match(createdOpportunity)
      await appendEvent({
        type: 'opportunity_matched',
        userId,
        reversible: false,
        payload: {
          opportunity: { id: createdOpportunity.id, tags: createdOpportunity.tags, type: createdOpportunity.type },
          matches
        }
      })
    } catch (e) {
      console.warn('Services: createOpportunity - match emit failed', e)
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

