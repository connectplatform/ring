import {
  FirestoreDataConverter,
  DocumentData,
  WithFieldValue,
  QueryDocumentSnapshot,
  FieldValue,
  Timestamp,
} from 'firebase-admin/firestore'; // Use Firebase Admin for server-side Firestore
import { Entity } from '@/features/entities/types';

/**
 * Helper function to safely convert various timestamp formats to Firestore Timestamp
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
 * Firestore data converter for the Entity type.
 */
export const entityConverter: FirestoreDataConverter<Entity> = {
  /**
   * Converts an `Entity` object to Firestore format.
   */
  toFirestore(entity: WithFieldValue<Entity>): DocumentData {
    return {
      // Default required fields
      name: entity.name ?? '', // Default: empty string
      type: entity.type ?? 'other', // Default: 'other'
      addedBy: entity.addedBy ?? '',
      visibility: entity.visibility ?? 'public',
      isConfidential: !!entity.isConfidential, // Force Boolean
      locale: entity.locale ?? 'en',
      location: entity.location ?? '',

      // Timestamps
      dateAdded: entity.dateAdded || FieldValue.serverTimestamp(),
      lastUpdated: entity.lastUpdated || FieldValue.serverTimestamp(),

      // Optional fields with reasonable default values
      shortDescription: entity.shortDescription ?? '',
      contactEmail: entity.contactEmail ?? null,
      employeeCount: entity.employeeCount ?? 0,
      memberSince: entity.memberSince || undefined,
      industries: entity.industries ?? [],
      certifications: entity.certifications ?? [],
      partnerships: entity.partnerships ?? [],
      services: entity.services ?? [],
      socialMedia: entity.socialMedia ?? null,
      tags: entity.tags ?? [],
      gallery: entity.gallery ?? [],
      upcomingEvents: entity.upcomingEvents ?? [],
      website: entity.website ?? null,
      phoneNumber: entity.phoneNumber ?? null,
      fullDescription: entity.fullDescription ?? '',
      logo: entity.logo ?? null,
      opportunities: entity.opportunities ?? [],
      members: entity.members ?? [],
      foundedYear: entity.foundedYear ?? null,
    };
  },

  /**
   * Converts a Firestore document snapshot to an `Entity` object.
   */
  fromFirestore(snapshot: QueryDocumentSnapshot): Entity {
    const data = snapshot.data(); // Remove options parameter

    return {
      // Required fields
      id: snapshot.id,
      locale: data.locale ?? 'en',
      name: data.name ?? 'Unknown',
      type: data.type ?? 'other',
      addedBy: data.addedBy ?? '',
      visibility: data.visibility ?? 'public',
      isConfidential: !!data.isConfidential, // Guarantee Boolean conversion
      location: data.location ?? '',

      // Convert various timestamp formats to Firestore Timestamps
      dateAdded: safeToTimestamp(data.dateAdded) || Timestamp.now(), // Defaults to current timestamp if missing
      lastUpdated: safeToTimestamp(data.lastUpdated) || Timestamp.now(), // Defaults to current timestamp

      // Optional fields with fallback/default behavior
      shortDescription: data.shortDescription ?? '',
      contactEmail: data.contactEmail ?? null,
      employeeCount: data.employeeCount ?? 0,
      memberSince: safeToTimestamp(data.memberSince), // Safe conversion with proper type checking
      industries: data.industries ?? [],
      certifications: data.certifications ?? [],
      partnerships: data.partnerships ?? [],
      services: data.services ?? [],
      socialMedia: data.socialMedia ?? null,
      tags: data.tags ?? [],
      gallery: data.gallery ?? [],
      upcomingEvents: data.upcomingEvents ?? [],
      website: data.website ?? null,
      phoneNumber: data.phoneNumber ?? null,
      fullDescription: data.fullDescription ?? '',
      logo: data.logo ?? null,
      opportunities: data.opportunities ?? [],
      members: data.members ?? [],
      foundedYear: data.foundedYear ?? null,
    };
  },
};

