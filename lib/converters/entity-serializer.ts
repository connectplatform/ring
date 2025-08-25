/**
 * Entity Serialization Utilities
 */

import { Timestamp } from 'firebase-admin/firestore'
import { Entity, SerializedEntity } from '@/features/entities/types'

/**
 * Helper function to safely convert various timestamp formats to Firestore Timestamp
 * Reused pattern from entity-converter.ts and opportunity-serializer.ts
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
 * Converts a SerializedEntity back to an Entity object
 * This is needed when passing data from server components to client components
 * that expect the full Entity type with Timestamp objects
 */
export function deserializeEntity(serialized: SerializedEntity): Entity {
  return {
    ...serialized,
    // Convert string dates back to Timestamp objects
    dateAdded: safeToTimestamp(serialized.dateAdded) || Timestamp.now(),
    lastUpdated: safeToTimestamp(serialized.lastUpdated) || Timestamp.now(),
    // Handle optional timestamp field
    memberSince: serialized.memberSince ? safeToTimestamp(serialized.memberSince) : undefined,
  }
}

/**
 * Converts an array of SerializedEntity objects to Entity objects
 * Batch conversion utility for lists and collections
 */
export function deserializeEntities(serialized: SerializedEntity[]): Entity[] {
  return serialized.map(deserializeEntity)
}

/**
 * Converts an Entity to SerializedEntity for JSON transport
 * Used when sending data from server to client components
 */
export function serializeEntity(entity: Entity): SerializedEntity {
  return {
    ...entity,
    // Convert Timestamp objects to ISO strings for JSON serialization
    dateAdded: entity.dateAdded instanceof Timestamp 
      ? entity.dateAdded.toDate().toISOString()
      : new Date().toISOString(),
    lastUpdated: entity.lastUpdated instanceof Timestamp 
      ? entity.lastUpdated.toDate().toISOString()
      : new Date().toISOString(),
    // Handle optional timestamp field
    memberSince: entity.memberSince instanceof Timestamp 
      ? entity.memberSince.toDate().toISOString()
      : typeof entity.memberSince === 'string' 
        ? entity.memberSince 
        : undefined,
  }
}

/**
 * Converts an array of Entity objects to SerializedEntity objects
 * Batch serialization utility for API responses and server-side rendering
 */
export function serializeEntities(entities: Entity[]): SerializedEntity[] {
  return entities.map(serializeEntity)
}
