// /features/opportunities/types/index.ts
import { Timestamp, FieldValue } from 'firebase/firestore';

export type OpportunityType = 'offer' | 'request' | 'partnership' | 'volunteer' | 'mentorship' | 'resource' | 'event' | 'ring_customization';
export type OpportunityVisibility = 'public' | 'subscriber' | 'member' | 'confidential';
export type OpportunityPriority = 'urgent' | 'normal' | 'low';

export interface Attachment {
  url: string;
  name: string;
}

export interface Opportunity {
  id: string;
  type: OpportunityType;
  title: string;
  isConfidential: boolean;
  briefDescription: string;
  fullDescription?: string;
  createdBy: string;
  organizationId: string;
  dateCreated: Timestamp | FieldValue;
  dateUpdated: Timestamp | FieldValue;
  expirationDate: Timestamp | FieldValue;
  applicationDeadline?: Timestamp | FieldValue;
  status: 'active' | 'closed' | 'expired';
  category: string;
  tags: string[];
  location: string;
  budget?: {
    min?: number;
    max: number;
    currency?: string;
  };
  requiredSkills: string[];
  requiredDocuments: string[];
  attachments: Attachment[];
  visibility: OpportunityVisibility;
  contactInfo: {
    linkedEntity: string;
    contactAccount: string;
  };
  // New tracking fields
  applicantCount: number;
  maxApplicants?: number;
  priority?: OpportunityPriority;
  // Logic: Offers require linkedEntity, requests can have isPrivate=true for individual posts
  isPrivate?: boolean;
}

// Serialized version for client components (dates as ISO strings)
export interface SerializedOpportunity {
  id: string;
  type: OpportunityType;
  title: string;
  isConfidential: boolean;
  briefDescription: string;
  fullDescription?: string;
  createdBy: string;
  organizationId: string;
  dateCreated: string;
  dateUpdated: string;
  expirationDate: string;
  applicationDeadline?: string;
  status: 'active' | 'closed' | 'expired';
  category: string;
  tags: string[];
  location: string;
  budget?: {
    min?: number;
    max: number;
    currency?: string;
  };
  requiredSkills: string[];
  requiredDocuments: string[];
  attachments: Attachment[];
  visibility: OpportunityVisibility;
  contactInfo: {
    linkedEntity: string;
    contactAccount: string;
  };
  // New tracking fields
  applicantCount: number;
  maxApplicants?: number;
  priority?: OpportunityPriority;
  // Logic: Offers require linkedEntity, requests can have isPrivate=true for individual posts
  isPrivate?: boolean;
}

export interface OpportunityFormData {
  type: OpportunityType;
  title: string;
  category: string;
  tags: string[];
  location: string;
  budget?: {
    min?: number;
    max: number;
    currency?: string;
  };
  requiredSkills: string[];
  expirationDate: Date;
  applicationDeadline?: Date;
  visibility: OpportunityVisibility;
  fullDescription: string;
  requirements: string;
  attachments: Attachment[];
  contactInfo: {
    linkedEntity: string;
    contactAccount: string;
  };
  // New tracking fields
  maxApplicants?: number;
  priority?: OpportunityPriority;
  // Logic: Offers require linkedEntity, requests can have isPrivate=true for individual posts
  isPrivate?: boolean;
}