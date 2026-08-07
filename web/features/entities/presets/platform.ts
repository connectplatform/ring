/**
 * Platform (professional networking) entities vertical preset (Tier-2 SSOT).
 * Selected via ring-config `entities.preset = "platform"` (default).
 */

import type { EntityTypeCatalog, EntitiesPresetModule } from './types'

/**
 * Industry categories — mirrors features/entities EntityType union + entity-type-icons.
 * Keep ids in sync with `features/entities/types` EntityType.
 */
export const entityTypes = {
  TECHNOLOGY_SOFTWARE: {
    id: 'technologySoftware',
    name: 'Technology & Software',
    description: 'Software, SaaS, AI, cloud, cybersecurity, and digital product companies',
    icon: '💻',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  MANUFACTURING_INDUSTRY: {
    id: 'manufacturingIndustry',
    name: 'Manufacturing & Industry',
    description: 'Production, industrial automation, and supply-chain organizations',
    icon: '🏭',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  FINANCIAL_SERVICES: {
    id: 'financialServices',
    name: 'Financial Services',
    description: 'Banking, fintech, insurance, investment, and financial advisory',
    icon: '🏦',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  HEALTHCARE_MEDICAL: {
    id: 'healthcareMedical',
    name: 'Healthcare & Medical',
    description: 'Hospitals, clinics, medtech, and health services providers',
    icon: '🏥',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  EDUCATION_TRAINING: {
    id: 'educationTraining',
    name: 'Education & Training',
    description: 'Universities, schools, edtech, and professional training providers',
    icon: '🎓',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  REAL_ESTATE_CONSTRUCTION: {
    id: 'realEstateConstruction',
    name: 'Real Estate & Construction',
    description: 'Developers, contractors, architecture, and property management',
    icon: '🏗️',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  RETAIL_ECOMMERCE: {
    id: 'retailEcommerce',
    name: 'Retail & E-commerce',
    description: 'Retail brands, marketplaces, and omnichannel commerce',
    icon: '🛒',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  PROFESSIONAL_SERVICES: {
    id: 'professionalServices',
    name: 'Professional Services',
    description: 'Accounting, HR, design, engineering, and B2B service firms',
    icon: '💼',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  MEDIA_ENTERTAINMENT: {
    id: 'mediaEntertainment',
    name: 'Media & Entertainment',
    description: 'Studios, publishers, streaming, gaming, and creative media',
    icon: '🎬',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  TRANSPORTATION_LOGISTICS: {
    id: 'transportationLogistics',
    name: 'Transportation & Logistics',
    description: 'Freight, mobility, warehousing, and last-mile delivery',
    icon: '🚚',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  ENERGY_UTILITIES: {
    id: 'energyUtilities',
    name: 'Energy & Utilities',
    description: 'Power, renewables, utilities, and energy infrastructure',
    icon: '⚡',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  AGRICULTURE_FOOD: {
    id: 'agricultureFood',
    name: 'Agriculture & Food',
    description: 'Agribusiness, food production, and related supply chains',
    icon: '🌾',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  GOVERNMENT_PUBLIC_SECTOR: {
    id: 'governmentPublicSector',
    name: 'Government & Public Sector',
    description: 'Agencies, municipalities, and public institutions',
    icon: '🏛️',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  NON_PROFIT_NGO: {
    id: 'nonProfitNgo',
    name: 'Non-Profit & NGO',
    description: 'Charities, foundations, and mission-driven organizations',
    icon: '🤝',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  RESEARCH_DEVELOPMENT: {
    id: 'researchDevelopment',
    name: 'Research & Development',
    description: 'Labs, R&D centers, and innovation organizations',
    icon: '🔬',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  CONSULTING_ADVISORY: {
    id: 'consultingAdvisory',
    name: 'Consulting & Advisory',
    description: 'Strategy, management, and specialized advisory firms',
    icon: '📊',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  LEGAL_SERVICES: {
    id: 'legalServices',
    name: 'Legal Services',
    description: 'Law firms, legal tech, and compliance services',
    icon: '⚖️',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  MARKETING_ADVERTISING: {
    id: 'marketingAdvertising',
    name: 'Marketing & Advertising',
    description: 'Agencies, media buyers, and brand/growth teams',
    icon: '📣',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  HOSPITALITY_TOURISM: {
    id: 'hospitalityTourism',
    name: 'Hospitality & Tourism',
    description: 'Hotels, travel, events, and guest experience providers',
    icon: '🏨',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  SPORTS_RECREATION: {
    id: 'sportsRecreation',
    name: 'Sports & Recreation',
    description: 'Teams, venues, fitness, and recreation operators',
    icon: '🏟️',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  ARTS_CULTURE: {
    id: 'artsCulture',
    name: 'Arts & Culture',
    description: 'Museums, galleries, performing arts, and cultural orgs',
    icon: '🎨',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  ENVIRONMENTAL_SERVICES: {
    id: 'environmentalServices',
    name: 'Environmental Services',
    description: 'Sustainability, conservation, and environmental tech',
    icon: '🌍',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  TELECOMMUNICATIONS: {
    id: 'telecommunications',
    name: 'Telecommunications',
    description: 'Carriers, ISPs, and telecom infrastructure',
    icon: '📡',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  AEROSPACE_DEFENSE: {
    id: 'aerospaceDefense',
    name: 'Aerospace & Defense',
    description: 'Aviation, space, and defense contractors',
    icon: '🚀',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  PHARMACEUTICALS: {
    id: 'pharmaceuticals',
    name: 'Pharmaceuticals',
    description: 'Pharma, biotech, and life-sciences manufacturers',
    icon: '💊',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  OTHER: {
    id: 'other',
    name: 'Other',
    description: 'Organizations that do not fit other industry categories',
    icon: '🏢',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
} as const satisfies EntityTypeCatalog

const platformPreset: EntitiesPresetModule = {
  entityTypes: entityTypes as unknown as EntityTypeCatalog,
}

export default platformPreset
