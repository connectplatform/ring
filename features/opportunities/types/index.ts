// /features/opportunities/types/index.ts
import { Timestamp, FieldValue } from 'firebase/firestore';

export type OpportunityType = 
  // REVOLUTIONARY TECHNICAL EXCELLENCE (Shown in UI now)
  | 'ring_customization'      // 🔥 Legion-powered Ring Platform cloning & customization
  | 'ai_instructor'           // 🎓 AI instructors teach product owners how to guide Legion
  // FUTURE UI ADDITIONS (Implemented but hidden until Phase 2)
  | 'collective_need'         // 🌐 Unsolved collective problems seeking Ring solutions  
  | 'platform_mentorship'     // ⚡ Experienced Ring deployers mentor newcomers
  | 'regional_deployment'     // 🌍 Deploy Ring in technology-deficit regions
  | 'language_localization'   // 🗣️ Translate Ring to new languages
  | 'ring_certification'      // 📚 Become certified Ring developer
  | 'ecosystem_contribution'  // 🎯 Contribute to Ring core/modules
  | 'success_story'           // 💎 Share Ring deployment case studies
  // LEGACY TYPES (Keep for backward compatibility)
  | 'offer'                   // Technology/job offers
  | 'request'                 // Technology/service requests
  | 'partnership'             // 🤝 Strategic partnerships
  | 'volunteer'               // 💚 Volunteer opportunities
  | 'mentorship'              // 🎓 Mentorship programs
  | 'resource'                // 🔧 Resource sharing
  | 'event';                  // 📅 Events and workshops
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