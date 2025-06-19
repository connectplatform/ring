import {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp,
  FieldValue,
} from 'firebase-admin/firestore';
import { Opportunity, OpportunityType, OpportunityVisibility, Attachment } from '@/types';

export const opportunityConverter: FirestoreDataConverter<Opportunity> = {
  toFirestore(opportunity: Opportunity): DocumentData {
    return {
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
      budget: opportunity.budget,
      requiredSkills: opportunity.requiredSkills,
      requiredDocuments: opportunity.requiredDocuments,
      attachments: opportunity.attachments,
      visibility: opportunity.visibility,
      contactInfo: opportunity.contactInfo,
    };
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
      status: data.status,
      category: data.category,
      tags: data.tags,
      location: data.location,
      budget: data.budget,
      requiredSkills: data.requiredSkills,
      requiredDocuments: data.requiredDocuments,
      attachments: data.attachments as Attachment[],
      visibility: data.visibility as OpportunityVisibility,
      contactInfo: data.contactInfo,
    };
  },
};

