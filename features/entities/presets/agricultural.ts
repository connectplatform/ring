/**
 * Agricultural / healthy-living entities vertical preset (Tier-2 SSOT).
 *
 * Ships in ring-platform.org; selected via ring-config `entities.preset = "agricultural"`.
 * Uniform export: `entityTypes` (UI catalog). Optional: `erpEntityTypes` (ERP field defs).
 *
 * Source: GreenFood.live catalog (moved into platform presets for clone-agnostic SSOT).
 */

import type { EntityTypeCatalog, EntitiesPresetModule } from './types'

export const HEALTHY_LIVING_ENTITY_TYPES = {
  YOGA_INSTRUCTOR: {
    id: 'yoga_teacher',
    name: 'Yoga Instructor',
    description: 'Certified yoga teachers and instructors offering classes, workshops, and private sessions.',
    icon: '🧘',
    requiredFields: ['location', 'shortDescription', 'services', 'contactEmail'],
  },
  NUTRITIONIST: {
    id: 'nutritionist',
    name: 'Nutritionist',
    description: 'Nutrition experts creating personalized nutrition plans and wellness programs.',
    icon: '🥗',
    requiredFields: ['location', 'shortDescription', 'services', 'certifications'],
  },
  WELLNESS_COACH: {
    id: 'wellness_coach',
    name: 'Wellness Coach',
    description: 'Holistic wellness professionals guiding healthy lifestyle transformations.',
    icon: '🌿',
    requiredFields: ['location', 'shortDescription', 'services', 'contactEmail'],
  },
  FITNESS_TRAINER: {
    id: 'fitness_trainer',
    name: 'Fitness Trainer',
    description: 'Certified trainers and instructors supporting movement, conditioning, and health goals.',
    icon: '🏋️',
    requiredFields: ['location', 'shortDescription', 'services', 'website'],
  },
  MINDFULNESS_INSTRUCTOR: {
    id: 'mindfulness_instructor',
    name: 'Mindfulness Instructor',
    description: 'Meditation and breathing coaches for resilience and stress balance.',
    icon: '🧠',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  MENTAL_HEALTH_SPECIALIST: {
    id: 'mental_health_specialist',
    name: 'Mental Health Specialist',
    description: 'Counselors and therapists supporting emotional wellbeing.',
    icon: '💚',
    requiredFields: ['location', 'shortDescription', 'services', 'certifications'],
  },
  MASSAGE_THERAPIST: {
    id: 'massage_therapist',
    name: 'Massage Therapist',
    description: 'Massage specialists offering recovery, pain management, and wellness treatments.',
    icon: '💆',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  PHYSIOTHERAPIST: {
    id: 'physiotherapist',
    name: 'Physiotherapist',
    description: 'Rehabilitation professionals focusing on movement recovery and injury prevention.',
    icon: '🩺',
    requiredFields: ['location', 'shortDescription', 'services', 'certifications'],
  },
  NUTRITION_SHOP: {
    id: 'nutrition_shop',
    name: 'Nutrition Shop',
    description: 'Retailers selling supplements, superfoods, and wellness nutrition products.',
    icon: '🍯',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  HERBALIST: {
    id: 'herbalist',
    name: 'Herbalist',
    description: 'Herbal medicine and plant-based remedy experts.',
    icon: '🌱',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  ESSENTIAL_OIL_STORE: {
    id: 'essential_oil_store',
    name: 'Essential Oil Store',
    description: 'Producers and stores of aromatic essential oils, blends, and wellness oils.',
    icon: '🧴',
    requiredFields: ['location', 'shortDescription', 'website'],
  },
  SOAP_MAKER: {
    id: 'soap_maker',
    name: 'Soap Maker',
    description: 'Artisanal soap shops and ethical natural beauty producers.',
    icon: '🧼',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  NATURAL_SKINCARE: {
    id: 'natural_skincare',
    name: 'Natural Skincare',
    description: 'Natural skincare brands and producers focused on clean ingredient routines.',
    icon: '🌼',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  HONEY_PRODUCER: {
    id: 'honey_producer',
    name: 'Honey Producer',
    description: 'Apiary operators offering raw honey, pollen, and bee products.',
    icon: '🍯',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  BEEKEEPING_COLLECTIVE: {
    id: 'beekeeping_collective',
    name: 'Beekeeping Collective',
    description: 'Collective groups supporting cooperative beekeeping and local pollinator projects.',
    icon: '🐝',
    requiredFields: ['location', 'shortDescription'],
  },
  ORGANIC_FARM: {
    id: 'organic_farm',
    name: 'Organic Farm',
    description: 'Farms producing certified organic fruits, vegetables, and herbs.',
    icon: '🌾',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  LOCAL_FARMERS_MARKET: {
    id: 'local_farmers_market',
    name: 'Local Farmers Market',
    description: 'Community markets connecting local growers and wholesome food producers.',
    icon: '🛒',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  VEGETABLE_GROWER: {
    id: 'vegetable_grower',
    name: 'Vegetable Grower',
    description: 'Growers and producers cultivating high-quality vegetables for healthy kitchens.',
    icon: '🥕',
    requiredFields: ['location', 'shortDescription'],
  },
  FERMENTED_FOOD_MAKER: {
    id: 'fermented_food_maker',
    name: 'Fermented Food Maker',
    description: 'Crafted kombucha, sauerkraut, kimchi, and probiotic foods.',
    icon: '🥣',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  COLD_PRESS_OILS: {
    id: 'cold_press_oils',
    name: 'Cold-Pressed Oils',
    description: 'Small-batch producers of organic and cold-pressed culinary oils.',
    icon: '🫗',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  HERBAL_TEA_MAKER: {
    id: 'herbal_tea_maker',
    name: 'Herbal Tea Maker',
    description: 'Blend specialists crafting functional tea blends and herbal infusions.',
    icon: '🍵',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  PLANT_BASED_COOK: {
    id: 'plant_based_cook',
    name: 'Plant-Based Cook',
    description: 'Culinary specialists focused on plant-based and wellness-oriented meals.',
    icon: '🌮',
    requiredFields: ['location', 'shortDescription', 'services'],
  },
  HEALTH_CAFE: {
    id: 'health_cafe',
    name: 'Health Cafe',
    description: 'Cafes and eateries offering nutrition-forward menus and wellness menus.',
    icon: '🥙',
    requiredFields: ['location', 'shortDescription'],
  },
  WELLNESS_CLINIC: {
    id: 'wellness_clinic',
    name: 'Wellness Clinic',
    description: 'Clinical or community clinics delivering preventive wellness services.',
    icon: '🏥',
    requiredFields: ['location', 'shortDescription', 'services', 'certifications'],
  },
} as const

export type HealthyLivingEntityType = keyof typeof HEALTHY_LIVING_ENTITY_TYPES

/** Uniform preset export — UI / filters use healthy-living catalog */
export const entityTypes = HEALTHY_LIVING_ENTITY_TYPES as unknown as EntityTypeCatalog

const agriculturalPreset: EntitiesPresetModule = {
  entityTypes,
}

export default agriculturalPreset
