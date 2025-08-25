import {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp,
  FieldValue,
} from 'firebase-admin/firestore';
import { Opportunity, OpportunityType, OpportunityVisibility, OpportunityPriority, Attachment } from '@/features/opportunities/types';

export const opportunityConverter: FirestoreDataConverter<Opportunity> = {
  toFirestore(opportunity: Opportunity): DocumentData {
    const data: DocumentData = {
      type: opportunity.type,
      title: opportunity.title,
      isConfidential: opportunity.isConfidential,
      briefDescription: opportunity.briefDescription,
      fullDescription: opportunity.fullDescription,
      createdBy: opportunity.createdBy,
      organizationId: opportunity.organizationId,
      dateCreated: opportunity.dateCreated instanceof Timestamp ? opportunity.dateCreated : FieldValue.serverTimestamp(),
      dateUpdated: opportunity.dateUpdated instanceof Timestamp ? opportunity.dateUpdated : FieldValue.serverTimestamp(),
      expirationDate: opportunity.expirationDate,
      status: opportunity.status,
      category: opportunity.category,
      tags: opportunity.tags,
      location: opportunity.location,
      requiredSkills: opportunity.requiredSkills,
      requiredDocuments: opportunity.requiredDocuments,
      attachments: opportunity.attachments,
      visibility: opportunity.visibility,
      contactInfo: opportunity.contactInfo,
      // New tracking fields
      applicantCount: opportunity.applicantCount || 0,
    };
    
    // Only include optional fields if they're defined to prevent Firestore undefined errors
    if (opportunity.budget !== undefined) {
      data.budget = {
        min: opportunity.budget.min,
        max: opportunity.budget.max,
        currency: opportunity.budget.currency,
      };
    }
    
    if (opportunity.applicationDeadline !== undefined) {
      data.applicationDeadline = opportunity.applicationDeadline;
    }
    
    if (opportunity.maxApplicants !== undefined) {
      data.maxApplicants = opportunity.maxApplicants;
    }
    
    if (opportunity.isPrivate !== undefined) {
      data.isPrivate = opportunity.isPrivate;
    }
    
    if (opportunity.priority !== undefined) {
      data.priority = opportunity.priority;
    }
    
    return data;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): Opportunity {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      type: data.type as OpportunityType,
      title: data.title,
      isConfidential: data.isConfidential,
      briefDescription: data.briefDescription,
      fullDescription: data.fullDescription,
      createdBy: data.createdBy,
      organizationId: data.organizationId,
      dateCreated: data.dateCreated instanceof Timestamp ? data.dateCreated : Timestamp.now(),
      dateUpdated: data.dateUpdated instanceof Timestamp ? data.dateUpdated : Timestamp.now(),
      expirationDate: data.expirationDate,
      applicationDeadline: data.applicationDeadline || undefined,
      status: data.status,
      category: data.category,
      tags: data.tags,
      location: data.location,
      budget: data.budget ? {
        min: data.budget.min,
        max: data.budget.max,
        currency: data.budget.currency,
      } : undefined, // Handle case where budget doesn't exist in Firestore
      requiredSkills: data.requiredSkills,
      requiredDocuments: data.requiredDocuments,
      attachments: data.attachments as Attachment[],
      visibility: data.visibility as OpportunityVisibility,
      contactInfo: data.contactInfo,
      // New tracking fields
      applicantCount: data.applicantCount || 0,
      maxApplicants: data.maxApplicants || undefined,
      priority: data.priority as OpportunityPriority || undefined,
      isPrivate: data.isPrivate || undefined,
    };
  },
};

