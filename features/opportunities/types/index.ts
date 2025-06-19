// /features/opportunities/types/index.ts
import { Timestamp, FieldValue } from 'firebase/firestore';

export type OpportunityType = 'offer' | 'request';
export type OpportunityVisibility = 'public' | 'subscriber' | 'member' | 'confidential';

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
  status: 'active' | 'closed' | 'expired';
  category: string;
  tags: string[];
  location: string;
  budget?: {
    min: number;
    max: number;
    currency: string;
  };
  requiredSkills: string[];
  requiredDocuments: string[];
  attachments: Attachment[];
  visibility: OpportunityVisibility;
  contactInfo: {
    linkedEntity: string;
    contactAccount: string;
  };
}

export interface OpportunityFormData {
  type: OpportunityType;
  title: string;
  description: string;
  category: string;
  tags: string[];
  location: string;
  budget?: {
    min: number;
    max: number;
    currency: string;
  };
  requiredSkills: string[];
  expirationDate: Date;
  visibility: OpportunityVisibility;
}