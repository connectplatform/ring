/**
 * Opportunity Serialization Utilities
 */

import { Timestamp } from 'firebase-admin/firestore'
import { Opportunity, SerializedOpportunity } from '@/features/opportunities/types'

/**
 * Helper function to safely convert various timestamp formats to Firestore Timestamp
 * Reused pattern from entity-converter.ts and news-converter.ts
 */
function safeToTimestamp(timestamp: any): Timestamp | undefined {
  if (!timestamp) return undefined;
  
  // If it's already a Timestamp, return it
  if (timestamp instanceof Timestamp) {
    return timestamp;
  }
  
  // If it has toDate method (Firestore timestamp-like object), try to convert
  if (typeof timestamp === 'object' && typeof timestamp.toDate === 'function') {
    try {
      const date = timestamp.toDate();
      return Timestamp.fromDate(date);
    } catch (error) {
      console.warn('Failed to convert timestamp-like object:', error);
      return undefined;
    }
  }
  
  // If it's a Date object, convert to Timestamp
  if (timestamp instanceof Date) {
    return Timestamp.fromDate(timestamp);
  }
  
  // If it's a string, try to parse as date then convert to Timestamp
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return Timestamp.fromDate(date);
    }
  }
  
  // If it's a number (milliseconds), convert to Timestamp
  if (typeof timestamp === 'number') {
    return Timestamp.fromMillis(timestamp);
  }
  
  return undefined;
}

/**
 * Converts a SerializedOpportunity back to an Opportunity object
 * This is needed when passing data from server components to client components
 * that expect the full Opportunity type with Timestamp objects
 */
export function deserializeOpportunity(serialized: SerializedOpportunity): Opportunity {
  return {
    ...serialized,
    // Convert string dates back to Timestamp objects
    dateCreated: safeToTimestamp(serialized.dateCreated) || Timestamp.now(),
    dateUpdated: safeToTimestamp(serialized.dateUpdated) || Timestamp.now(),
    // Handle optional timestamp fields
    expirationDate: serialized.expirationDate ? safeToTimestamp(serialized.expirationDate) : undefined,
    applicationDeadline: serialized.applicationDeadline ? safeToTimestamp(serialized.applicationDeadline) : undefined,
  }
}

/**
 * Converts an array of SerializedOpportunity objects to Opportunity objects
 * Batch conversion utility for lists and collections
 */
export function deserializeOpportunities(serialized: SerializedOpportunity[]): Opportunity[] {
  return serialized.map(deserializeOpportunity)
}

/**
 * Converts an Opportunity to SerializedOpportunity for JSON transport
 * Used when sending data from server to client components
 */
export function serializeOpportunity(opportunity: Opportunity): SerializedOpportunity {
  return {
    ...opportunity,
    // Convert Timestamp objects to ISO strings for JSON serialization
    dateCreated: opportunity.dateCreated instanceof Timestamp 
      ? opportunity.dateCreated.toDate().toISOString()
      : new Date().toISOString(),
    dateUpdated: opportunity.dateUpdated instanceof Timestamp 
      ? opportunity.dateUpdated.toDate().toISOString()
      : new Date().toISOString(),
    // Handle optional timestamp fields
    expirationDate: opportunity.expirationDate instanceof Timestamp 
      ? opportunity.expirationDate.toDate().toISOString()
      : typeof opportunity.expirationDate === 'string' 
        ? opportunity.expirationDate 
        : undefined,
    applicationDeadline: opportunity.applicationDeadline instanceof Timestamp 
      ? opportunity.applicationDeadline.toDate().toISOString()
      : typeof opportunity.applicationDeadline === 'string' 
        ? opportunity.applicationDeadline 
        : undefined,
  }
}

/**
 * Converts an array of Opportunity objects to SerializedOpportunity objects
 * Batch serialization utility for API responses and server-side rendering
 */
export function serializeOpportunities(opportunities: Opportunity[]): SerializedOpportunity[] {
  return opportunities.map(serializeOpportunity)
}
