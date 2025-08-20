// Seed sample entities into Firestore using Firebase Admin SDK (ESM)
// Usage: npm run seed:entities

import dotenv from 'dotenv'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

// Load environment variables from .env.local first (fallback to .env)
dotenv.config({ path: '.env.local' })
dotenv.config()

function ensureEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

const app = initializeApp({
  credential: cert({
    projectId: ensureEnv('AUTH_FIREBASE_PROJECT_ID'),
    clientEmail: ensureEnv('AUTH_FIREBASE_CLIENT_EMAIL'),
    privateKey: ensureEnv('AUTH_FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n')
  })
})

const db = getFirestore(app)

const categories = [
  'SoftwareDevelopment', 'Manufacturing', 'TechnologyCenter', 'LaserCutting',
  'CncMachining', '3dPrinting', 'Robotics', 'ElectronicManufacturing',
  'IotDevelopment', 'AiMachineLearning', 'VirtualReality', 'DroneTechnology',
  'Cybersecurity', 'CloudComputing', 'BlockchainDevelopment', 'Biotechnology',
  'CleanEnergy', 'SmartMaterials', 'IndustrialDesign', 'PrecisionEngineering',
  'CompositeManufacturing', 'PlasticInjectionMolding', 'MetalFabrication',
  'SemiconductorProduction', 'QuantumComputing'
];

const mockEntities = [
  // Visible to all (public)
  {
    __id: 'sample-entity-1',
    name: 'TechnoSoft Solutions',
    type: 'softwareDevelopment',
    shortDescription: 'Innovative software solutions for businesses',
    logo: 'https://example.com/technosoft-logo.png',
    location: 'Cherkasy, Ukraine',
    fullDescription: 'TechnoSoft Solutions is a leading software development company specializing in custom enterprise solutions, mobile applications, and cloud services.',
    tags: ['software', 'enterprise', 'mobile', 'cloud'],
    website: 'https://technosoft-solutions.com',
    gallery: [
      { url: 'https://example.com/technosoft-office.jpg', description: 'Our modern office space' },
      { url: 'https://example.com/technosoft-team.jpg', description: 'Our talented team' }
    ],
    visibility: 'public',
    isConfidential: false,
    contactEmail: 'info@technosoft-solutions.com',
    phoneNumber: '+380_123_456_789',
    socialMedia: {
      facebook: 'https://facebook.com/technosoft',
      linkedin: 'https://linkedin.com/company/technosoft-solutions',
      twitter: 'https://twitter.com/technosoft'
    },
    foundedYear: 2010,
    employeeCount: 150,
    industries: ['Finance', 'Healthcare', 'Retail'],
    services: ['Custom Software Development', 'Mobile App Development', 'Cloud Migration'],
    certifications: ['ISO 9001', 'Microsoft Gold Partner'],
    partnerships: ['AWS', 'Google Cloud'],
    upcomingEvents: [
      { name: 'TechnoSoft Dev Conference', date: new Date('2024-09-15').toISOString(), description: 'Annual developer conference showcasing our latest innovations' }
    ],
    memberSince: Timestamp.fromDate(new Date('2022-01-01')), 
    lastUpdated: FieldValue.serverTimestamp(),
    addedBy: 'system',
    dateAdded: FieldValue.serverTimestamp(),
    members: [],
    opportunities: []
  },
  // Visible to subscribers and above
  {
    __id: 'sample-entity-2',
    name: 'InnovaTech Manufacturing',
    type: 'manufacturing',
    shortDescription: 'Cutting-edge manufacturing solutions',
    logo: 'https://example.com/innovatech-logo.png',
    location: 'Cherkasy, Ukraine',
    fullDescription: 'InnovaTech Manufacturing combines traditional manufacturing expertise with the latest in Industry 4.0 technologies to deliver high-quality products.',
    tags: ['manufacturing', 'industry4.0', 'automation'],
    website: 'https://innovatech-mfg.com',
    gallery: [
      { url: 'https://example.com/innovatech-factory.jpg', description: 'Our state-of-the-art factory' },
      { url: 'https://example.com/innovatech-products.jpg', description: 'Some of our innovative products' }
    ],
    visibility: 'subscriber',
    isConfidential: false,
    contactEmail: 'contact@innovatech-mfg.com',
    phoneNumber: '+380_987_654_321',
    socialMedia: {
      linkedin: 'https://linkedin.com/company/innovatech-manufacturing',
      twitter: 'https://twitter.com/innovatech_mfg'
    },
    foundedYear: 2015,
    employeeCount: 200,
    industries: ['Automotive', 'Aerospace', 'Consumer Electronics'],
    services: ['Precision Manufacturing', '3D Printing', 'Quality Assurance'],
    certifications: ['ISO 9001', 'AS9100'],
    partnerships: ['Siemens', 'Autodesk'],
    upcomingEvents: [
      { name: 'InnovaTech Industry 4.0 Showcase', date: new Date('2024-10-20').toISOString(), description: 'Showcasing our latest Industry 4.0 implementations' }
    ],
    memberSince: Timestamp.fromDate(new Date('2023-03-15')),
    lastUpdated: FieldValue.serverTimestamp(),
    addedBy: 'system',
    dateAdded: FieldValue.serverTimestamp(),
    members: [],
    opportunities: []
  },
  // Confidential entity (visible only to CONFIDENTIAL or ADMIN roles)
  {
    __id: 'confidential-entity-1',
    name: 'Quantum Labs X',
    type: 'quantumComputing',
    shortDescription: 'Private R&D lab focusing on quantum materials',
    logo: 'https://example.com/quantum-labs-x.png',
    location: 'Secret Facility',
    fullDescription: 'Confidential research initiatives in quantum materials and superconducting qubits.',
    tags: ['quantum', 'R&D', 'superconducting'],
    website: null,
    gallery: [],
    visibility: 'confidential',
    isConfidential: true,
    contactEmail: null,
    phoneNumber: null,
    socialMedia: null,
    foundedYear: 2021,
    employeeCount: 25,
    industries: ['Research'],
    services: [],
    certifications: [],
    partnerships: [],
    upcomingEvents: [],
    memberSince: Timestamp.fromDate(new Date('2024-01-15')),
    lastUpdated: FieldValue.serverTimestamp(),
    addedBy: 'system',
    dateAdded: FieldValue.serverTimestamp(),
    members: [],
    opportunities: []
  }
]

// Note: This script only seeds entities. Opportunities are seeded via scripts/seed-opportunities.js

function getCliOptions() {
  const argv = process.argv.slice(2)
  return {
    overwrite: argv.includes('--overwrite'),
    prompt: argv.includes('--prompt'),
    dryRun: argv.includes('--dry-run')
  }
}

async function getExistingEntityIds(targetIds) {
  const results = new Map()
  for (const id of targetIds) {
    const snap = await db.collection('entities').doc(id).get()
    results.set(id, snap.exists)
  }
  return results
}

async function addMockData() {
  try {
    const opts = getCliOptions()
    const targetIds = mockEntities.map(e => e.__id).filter(Boolean)
    const existingMap = await getExistingEntityIds(targetIds)
    const existingIds = targetIds.filter(id => existingMap.get(id))
    const missingIds = targetIds.filter(id => !existingMap.get(id))

    console.log(`Found ${existingIds.length} existing, ${missingIds.length} missing entities among ${targetIds.length} targets.`)

    let overwriteExisting = opts.overwrite
    let skipExisting = false

    if (!opts.dryRun && existingIds.length > 0 && !opts.overwrite) {
      if (opts.prompt || process.stdin.isTTY) {
        const rl = readline.createInterface({ input, output })
        const answer = (await rl.question(`Overwrite ${existingIds.length} existing entities? (y/N) `)).trim().toLowerCase()
        rl.close()
        if (answer === 'y' || answer === 'yes') {
          overwriteExisting = true
        } else {
          skipExisting = true
        }
      } else {
        console.log('Existing entities found; run with --overwrite to update or --prompt to confirm interactively. Skipping existing by default.')
        skipExisting = true
      }
    }

    if (opts.dryRun) {
      console.log('[dry-run] Would upsert entities:', targetIds)
      return
    }

    // Upsert mock entities with stable IDs
    for (const entity of mockEntities) {
      const id = entity.__id || undefined
      const { __id, ...payload } = entity
      const exists = id ? existingMap.get(id) : false
      if (exists && skipExisting) {
        console.log(`Skipping existing entity: ${payload.name} (${id})`)
        continue
      }
      const ref = id ? db.collection('entities').doc(id) : db.collection('entities').doc()
      await ref.set({
        ...payload,
        // Ensure server-managed timestamps
        dateAdded: FieldValue.serverTimestamp(),
        lastUpdated: FieldValue.serverTimestamp(),
      }, { merge: true })
      console.log(`${exists ? 'Updated' : 'Added'} entity: ${payload.name} with ID: ${ref.id}`)
    }

    console.log('Mock entities added successfully')
  } catch (error) {
    console.error('Error adding mock entities:', error)
    process.exit(1)
  }
}

addMockData().then(() => process.exit(0))