import { Timestamp } from 'firebase-admin/firestore';

// Entity Industry sectors 
export type EntityType =
  | '3dPrinting'
  | 'aiMachineLearning'
  | 'biotechnology'
  | 'blockchainDevelopment'
  | 'cleanEnergy'
  | 'cloudComputing'
  | 'cncMachining'
  | 'compositeManufacturing'
  | 'cybersecurity'
  | 'droneTechnology'
  | 'electronicManufacturing'
  | 'industrialDesign'
  | 'iotDevelopment'
  | 'laserCutting'
  | 'manufacturing'
  | 'metalFabrication'
  | 'other'
  | 'plasticInjectionMolding'
  | 'precisionEngineering'
  | 'quantumComputing'
  | 'robotics'
  | 'semiconductorProduction'
  | 'smartMaterials'
  | 'softwareDevelopment'
  | 'technologyCenter'
  | 'virtualReality';

export interface Entity {
  addedBy: string;
  certifications?: string[];
  contactEmail?: string;
  dateAdded: Timestamp;
  employeeCount?: number;
  foundedYear?: number;
  fullDescription?: string;
  gallery?: { description: string; url: string }[];
  id: string;
  industries?: string[];
  isConfidential: boolean;
  lastUpdated: Timestamp;
  locale: string;
  location: string;
  logo?: string;
  memberSince?: Timestamp;
  name: string;
  partnerships?: string[];
  phoneNumber?: string;
  services?: string[];
  shortDescription: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    twitter?: string;
  };
  tags?: string[];
  type: EntityType;
  upcomingEvents?: {
    date: string;
    description: string;
    name: string;
  }[];
  visibility: 'public' | 'subscriber' | 'member' | 'confidential';
  website?: string;
  members: string[];
  opportunities: string[];
}

// Serialized version for client components (dates as ISO strings)
export interface SerializedEntity {
  addedBy: string;
  certifications?: string[];
  contactEmail?: string;
  dateAdded: string;
  employeeCount?: number;
  foundedYear?: number;
  fullDescription?: string;
  gallery?: { description: string; url: string }[];
  id: string;
  industries?: string[];
  isConfidential: boolean;
  lastUpdated: string;
  locale: string;
  location: string;
  logo?: string;
  memberSince?: string;
  name: string;
  partnerships?: string[];
  phoneNumber?: string;
  services?: string[];
  shortDescription: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    twitter?: string;
  };
  tags?: string[];
  type: EntityType;
  upcomingEvents?: {
    date: string;
    description: string;
    name: string;
  }[];
  visibility: 'public' | 'subscriber' | 'member' | 'confidential';
  website?: string;
  members: string[];
  opportunities: string[];
}

