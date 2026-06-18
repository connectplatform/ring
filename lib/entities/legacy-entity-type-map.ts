/**
 * Maps retired manufacturing-niche entity type slugs → current professional categories.
 * Archive: retired-ring-categories.md
 */

import type { EntityType } from '@/features/entities/types'

/** @deprecated Slugs from pre-2026-06-15 taxonomy — display-only until DB backfill */
export type LegacyEntityType =
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
  | 'plasticInjectionMolding'
  | 'precisionEngineering'
  | 'quantumComputing'
  | 'robotics'
  | 'semiconductorProduction'
  | 'smartMaterials'
  | 'softwareDevelopment'
  | 'technologyCenter'
  | 'virtualReality'

export const LEGACY_ENTITY_TYPE_MAP: Record<LegacyEntityType, EntityType> = {
  softwareDevelopment: 'technologySoftware',
  aiMachineLearning: 'technologySoftware',
  blockchainDevelopment: 'technologySoftware',
  cloudComputing: 'technologySoftware',
  cybersecurity: 'technologySoftware',
  iotDevelopment: 'technologySoftware',
  quantumComputing: 'technologySoftware',
  manufacturing: 'manufacturingIndustry',
  cncMachining: 'manufacturingIndustry',
  compositeManufacturing: 'manufacturingIndustry',
  electronicManufacturing: 'manufacturingIndustry',
  laserCutting: 'manufacturingIndustry',
  metalFabrication: 'manufacturingIndustry',
  plasticInjectionMolding: 'manufacturingIndustry',
  precisionEngineering: 'manufacturingIndustry',
  robotics: 'manufacturingIndustry',
  semiconductorProduction: 'manufacturingIndustry',
  smartMaterials: 'manufacturingIndustry',
  '3dPrinting': 'manufacturingIndustry',
  biotechnology: 'healthcareMedical',
  cleanEnergy: 'energyUtilities',
  droneTechnology: 'aerospaceDefense',
  industrialDesign: 'professionalServices',
  technologyCenter: 'researchDevelopment',
  virtualReality: 'mediaEntertainment',
}

const CURRENT_TYPE_IDS = new Set<string>([
  'technologySoftware',
  'manufacturingIndustry',
  'financialServices',
  'healthcareMedical',
  'educationTraining',
  'realEstateConstruction',
  'retailEcommerce',
  'professionalServices',
  'mediaEntertainment',
  'transportationLogistics',
  'energyUtilities',
  'agricultureFood',
  'governmentPublicSector',
  'nonProfitNgo',
  'researchDevelopment',
  'consultingAdvisory',
  'legalServices',
  'marketingAdvertising',
  'hospitalityTourism',
  'sportsRecreation',
  'artsCulture',
  'environmentalServices',
  'telecommunications',
  'aerospaceDefense',
  'pharmaceuticals',
  'other',
])

/** Normalize stored type slug (current or legacy) to a current EntityType. */
export function resolveEntityType(type: string): EntityType {
  if (CURRENT_TYPE_IDS.has(type)) {
    return type as EntityType
  }
  const mapped = LEGACY_ENTITY_TYPE_MAP[type as LegacyEntityType]
  if (mapped) {
    return mapped
  }
  return 'other'
}
