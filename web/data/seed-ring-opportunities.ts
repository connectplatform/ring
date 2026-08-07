/**
 * Seed data for Ring Platform Customization opportunities
 * These example opportunities showcase the types of Ring platform projects available
 */

import { Timestamp } from 'firebase/firestore';
import type { Opportunity } from '@/features/opportunities/types';

export const seedRingOpportunities: Partial<Opportunity>[] = [
  {
    type: 'ring_customization',
    title: 'Deploy Ring Platform for Ukrainian Agricultural Cooperative (50 farms)',
    briefDescription: 'Need full Ring platform deployment for agricultural cooperative connecting 50 farms in Cherkasy region for supply chain optimization.',
    fullDescription: `We are looking for an experienced Ring platform developer to deploy and customize a complete Ring instance for our agricultural cooperative.

Requirements:
- Deploy Ring platform with custom branding for "AgroUnion Cherkasy"
- Configure PostgreSQL database backend for 50+ farm entities
- Set up opportunities module for crop sales and equipment sharing
- Implement RING token economy for internal transactions
- Customize AI matching for agricultural products and buyers
- Multi-language support (Ukrainian primary, English secondary)
- Integration with local payment gateway (Monobank/PrivatBank)
- Training for 10 cooperative administrators

The cooperative consists of 50 farms ranging from 20 to 500 hectares, producing wheat, corn, sunflower, and vegetables. We need the platform operational within 30 days for the upcoming harvest season.`,
    category: 'platform_deployment',
    tags: ['agriculture', 'ukraine', 'cooperative', 'supply-chain', 'postgresql', 'multi-tenant'],
    location: 'Cherkasy, Ukraine',
    budget: {
      min: 5000,
      max: 15000,
      currency: 'USD'
    },
    requiredSkills: ['Ring Platform', 'PostgreSQL', 'Node.js', 'React', 'Payment Integration', 'Ukrainian'],
    priority: 'urgent',
    visibility: 'public',
    status: 'active',
    applicantCount: 0
  },
  {
    type: 'ring_customization',
    title: 'White-label Ring for Kenyan Artisan Crafts Marketplace',
    briefDescription: 'Deploy Ring-powered marketplace connecting 200+ artisan groups in Kenya with global buyers.',
    fullDescription: `Karibu Crafts Initiative seeks a Ring platform specialist to create a branded marketplace for Kenyan artisans.

Project Scope:
- Full white-label deployment with "Karibu Crafts" branding
- Custom theme with African-inspired design elements
- Store module configuration for 200+ vendor accounts
- NFT marketplace for authentic craft certificates
- M-Pesa payment integration (critical requirement)
- AI matching between craft styles and buyer preferences
- Multi-currency support (KES, USD, EUR, GBP)
- Mobile-first responsive design for feature phone browsers
- Swahili and English language support

Special Requirements:
- Low-bandwidth optimization for rural Kenya internet
- SMS notifications integration for vendors without smartphones
- QR code generation for craft authentication
- Integration with local logistics partners

Timeline: 6 weeks
Budget includes hosting setup on African cloud infrastructure.`,
    category: 'platform_deployment',
    tags: ['marketplace', 'africa', 'kenya', 'e-commerce', 'mobile-first', 'nft'],
    location: 'Nairobi, Kenya (Remote OK)',
    budget: {
      min: 8000,
      max: 20000,
      currency: 'USD'
    },
    requiredSkills: ['Ring Platform', 'E-commerce', 'M-Pesa API', 'Mobile Optimization', 'NFT', 'Swahili'],
    priority: 'normal',
    visibility: 'public',
    status: 'active',
    applicantCount: 0
  },
  {
    type: 'ring_customization',
    title: 'Custom NFT Marketplace Module for Digital Artists Collective',
    briefDescription: 'Develop enhanced NFT marketplace module for Ring platform with advanced royalty distribution.',
    fullDescription: `ArtDAO collective needs a custom NFT marketplace module built on top of Ring platform.

Technical Requirements:
- Extend existing Ring NFT module with advanced features
- Smart contract for automatic royalty distribution to multiple artists
- Integration with IPFS for decentralized storage
- Support for multiple blockchain networks (Ethereum, Polygon, Solana)
- Lazy minting to reduce gas fees
- Auction system with timed and reserve price options
- Collection management with rarity traits
- Advanced analytics dashboard for artists
- Social features: following, likes, comments on NFTs

The module should integrate seamlessly with Ring's existing authentication and wallet systems. We have 50 artists ready to onboard immediately after launch.

Preferred: Experience with generative art and on-chain metadata.`,
    category: 'module_development',
    tags: ['nft', 'blockchain', 'web3', 'smart-contracts', 'ipfs', 'defi'],
    location: 'Remote',
    budget: {
      min: 10000,
      max: 25000,
      currency: 'USD'
    },
    requiredSkills: ['Solidity', 'Web3.js', 'IPFS', 'React', 'Ring Platform', 'Smart Contracts'],
    priority: 'normal',
    visibility: 'public',
    status: 'active',
    applicantCount: 0
  },
  {
    type: 'ring_customization',
    title: 'Migrate Medical Equipment Sharing Network from Firebase to PostgreSQL',
    briefDescription: 'Migrate existing Ring deployment from Firebase to PostgreSQL with zero downtime for 24/7 medical network.',
    fullDescription: `MedShare Network operates a Ring platform instance connecting 100+ hospitals for medical equipment sharing. We need to migrate from Firebase to PostgreSQL for cost optimization and data sovereignty.

Critical Requirements:
- Zero downtime migration (24/7 medical operations)
- Data migration for 10,000+ equipment listings
- 50,000+ historical transactions preservation
- User accounts and permissions migration
- Maintain all existing API endpoints
- Backup and rollback procedures
- HIPAA compliance validation
- Performance optimization for PostgreSQL

Current Setup:
- 100+ hospital entities
- 5,000+ active users
- 10GB Firebase database
- Real-time notifications critical
- Custom medical equipment categories

Success Criteria:
- 50% reduction in database costs
- Same or better query performance
- Complete data integrity
- Comprehensive migration documentation`,
    category: 'database_migration',
    tags: ['postgresql', 'firebase', 'migration', 'healthcare', 'hipaa', 'zero-downtime'],
    location: 'Remote',
    budget: {
      min: 7000,
      max: 15000,
      currency: 'USD'
    },
    requiredSkills: ['PostgreSQL', 'Firebase', 'Database Migration', 'Node.js', 'Ring Platform', 'HIPAA'],
    priority: 'urgent',
    visibility: 'public',
    status: 'active',
    applicantCount: 0
  },
  {
    type: 'ring_customization',
    title: 'AI-Powered Opportunity Matching Enhancement for Real Estate Platform',
    briefDescription: 'Customize Ring AI matcher for sophisticated real estate opportunity matching with property-specific factors.',
    fullDescription: `RealtyRing operates a Ring platform for real estate opportunities. We need advanced AI customization for better property matching.

AI Enhancement Requirements:
- Extend matching algorithm with real estate factors:
  * Property type compatibility
  * Price per square meter analysis
  * Neighborhood demographics matching
  * Investment ROI calculations
  * Zoning and land use compatibility
  * School district ratings integration
  * Crime statistics weighting
  * Public transport accessibility scoring
  
- Natural language processing for property descriptions
- Image analysis for property photos (quality, features detection)
- Market trend integration for pricing recommendations
- Automated comparable property analysis
- Multilingual support (English, Spanish, Mandarin)

Integration Requirements:
- Connect to MLS (Multiple Listing Service) APIs
- Zillow/Redfin data integration
- Google Maps API for location analysis
- Custom scoring weights configurable per user preference

Deliverables include trained model, documentation, and 30-day support.`,
    category: 'ai_customization',
    tags: ['ai', 'machine-learning', 'real-estate', 'nlp', 'computer-vision', 'data-science'],
    location: 'United States (Remote)',
    budget: {
      min: 15000,
      max: 30000,
      currency: 'USD'
    },
    requiredSkills: ['Machine Learning', 'Python', 'TensorFlow', 'NLP', 'Ring Platform', 'Real Estate'],
    priority: 'normal',
    visibility: 'public',
    status: 'active',
    applicantCount: 0
  },
  {
    type: 'ring_customization',
    title: 'Multi-lingual Localization for Latin American Expansion',
    briefDescription: 'Localize Ring platform for 5 Latin American countries with regional payment gateways.',
    fullDescription: `Growing startup needs Ring platform localized for Latin American market expansion.

Localization Scope:
- Languages: Spanish (Mexico, Argentina, Colombia), Portuguese (Brazil)
- Regional variations and colloquialisms
- Right-to-left number formatting for currencies
- Date/time format localization
- Legal documents translation (Terms, Privacy, GDPR)

Payment Integration:
- MercadoPago (Argentina, Mexico, Brazil)
- PSE (Colombia)  
- SPEI (Mexico)
- PIX (Brazil)
- Currency conversion with live rates

Cultural Adaptation:
- Color scheme adjustments for cultural preferences
- Local business practices in opportunity templates
- Regional category taxonomies
- Local phone number validation
- Address format per country

Compliance:
- Data residency requirements per country
- Tax calculation for each jurisdiction
- Invoice format compliance

Timeline: 8 weeks with phased rollout per country.`,
    category: 'localization',
    tags: ['localization', 'spanish', 'portuguese', 'payment-gateway', 'latin-america', 'i18n'],
    location: 'Latin America (Remote)',
    budget: {
      min: 6000,
      max: 12000,
      currency: 'USD'
    },
    requiredSkills: ['Spanish', 'Portuguese', 'Payment APIs', 'i18n', 'Ring Platform', 'React'],
    priority: 'normal',
    visibility: 'public',
    status: 'active',
    applicantCount: 0
  },
  {
    type: 'ring_customization',
    title: 'Design Custom RING Token Economy for Education Platform',
    briefDescription: 'Design and implement token economics for education platform with learn-to-earn mechanics.',
    fullDescription: `EduRing needs a comprehensive token economy design for our education platform built on Ring.

Token Economy Design:
- Token distribution model:
  * 40% Learning rewards pool
  * 20% Teacher incentives
  * 20% Platform development
  * 10% Initial liquidity
  * 10% Team and advisors (vested)

- Earning Mechanisms:
  * Complete courses: 10-100 RING
  * Peer tutoring: 5 RING/hour
  * Content creation: 50-500 RING
  * Quality reviews: 2 RING each
  * Daily login streak bonuses

- Spending Utilities:
  * Premium courses access
  * 1-on-1 tutoring sessions
  * Certification minting
  * Priority support
  * Ad-free experience

- Economic Balance:
  * Inflation/deflation mechanisms
  * Token burning for certificates
  * Staking for governance rights
  * Liquidity pool rewards

Smart Contract Requirements:
- ERC-20 token with additional features
- Vesting contracts for team tokens
- Staking mechanism
- Governance voting system
- Multi-signature treasury

Documentation needed: Whitepaper, tokenomics model, smart contract audit.`,
    category: 'token_economics',
    tags: ['tokenomics', 'blockchain', 'defi', 'education', 'smart-contracts', 'web3'],
    location: 'Remote',
    budget: {
      min: 12000,
      max: 25000,
      currency: 'USD'
    },
    requiredSkills: ['Token Economics', 'Solidity', 'DeFi', 'Smart Contracts', 'Ring Platform', 'Education'],
    priority: 'normal',
    visibility: 'public',
    status: 'active',
    applicantCount: 0
  },
  {
    type: 'ring_customization',
    title: 'ConnectPlatform Backend Integration for Enterprise Deployment',
    briefDescription: 'Integrate Ring platform with existing ConnectPlatform infrastructure for Fortune 500 company.',
    fullDescription: `Major enterprise client needs Ring platform integrated with their existing ConnectPlatform backend.

Integration Requirements:
- ConnectPlatform BERT protocol implementation
- FastTransponder transport layer setup
- Multi-transport support (Internet/Radio/Bluetooth)
- Erlang/OTP supervision tree integration
- Connect existing user base (50,000+ users)
- Maintain ConnectPlatform's real-time capabilities
- ASN.1 message format compatibility

Security Requirements:
- End-to-end encryption
- Certificate-based authentication
- Role-based access control migration
- Audit logging to enterprise standards
- SOC 2 compliance maintenance

Performance Requirements:
- Support 10,000 concurrent users
- Message latency < 100ms
- 99.99% uptime SLA
- Horizontal scaling capability

Migration Scope:
- 500GB existing data
- Custom business logic preservation
- Zero downtime cutover
- Rollback procedures
- 90-day parallel run capability

Requires ConnectPlatform experience and enterprise integration expertise.`,
    category: 'database_migration',
    tags: ['connectplatform', 'enterprise', 'erlang', 'integration', 'real-time', 'bert'],
    location: 'Remote (US timezone preferred)',
    budget: {
      min: 20000,
      max: 40000,
      currency: 'USD'
    },
    requiredSkills: ['ConnectPlatform', 'Erlang', 'Enterprise Integration', 'Ring Platform', 'Real-time Systems'],
    priority: 'urgent',
    visibility: 'public',
    status: 'active',
    applicantCount: 0
  },
  {
    type: 'ring_customization',
    title: 'Documentation and Training Package for Government Portal',
    briefDescription: 'Create comprehensive documentation and training materials for government Ring deployment.',
    fullDescription: `State government has deployed Ring platform for citizen services. Need professional documentation and training package.

Documentation Requirements:
- System architecture documentation
- API reference with examples
- Administrator guide (200+ pages)
- User manuals for 5 user roles
- Security and compliance documentation
- Disaster recovery procedures
- Performance tuning guide
- Integration guides for 10 government systems

Training Materials:
- Video tutorials (20 hours total)
  * Platform overview (2 hours)
  * Administrator training (8 hours)
  * Department user training (6 hours)
  * Developer training (4 hours)
- Interactive tutorials with sandbox
- Quick reference cards (printable)
- PowerPoint presentations for stakeholders
- Certification exam questions (200+)

Localization:
- English primary
- Spanish translation required
- Accessibility compliance (WCAG 2.1 AA)
- Screen reader compatible formats

Delivery Format:
- Markdown source files
- PDF exports
- HTML documentation site
- SCORM packages for LMS
- Printed manuals option

90-day support for questions and updates included.`,
    category: 'documentation_training',
    tags: ['documentation', 'training', 'government', 'technical-writing', 'video-production', 'accessibility'],
    location: 'United States (Remote)',
    budget: {
      min: 10000,
      max: 20000,
      currency: 'USD'
    },
    requiredSkills: ['Technical Writing', 'Video Production', 'Ring Platform', 'Training Development', 'Spanish'],
    priority: 'normal',
    visibility: 'public',
    status: 'active',
    applicantCount: 0
  },
  {
    type: 'ring_customization',
    title: 'Stripe & Crypto Payment Gateway Integration',
    briefDescription: 'Integrate Stripe and cryptocurrency payments into Ring platform for global SaaS product.',
    fullDescription: `SaaS startup needs comprehensive payment integration for Ring platform instance.

Stripe Integration:
- Subscription management (monthly/annual)
- Usage-based billing for API calls
- Multi-currency support (20+ currencies)
- Invoice generation and management
- Dunning management for failed payments
- Customer portal integration
- Webhook handling for all events
- PCI compliance implementation

Cryptocurrency Integration:
- Accept payments in BTC, ETH, USDC, USDT
- WalletConnect integration
- MetaMask support
- Coinbase Commerce integration
- Real-time price conversion
- On-chain payment verification
- Automatic refund handling
- Tax reporting exports

Platform Integration:
- Update Ring wallet module
- Transaction history with fiat/crypto
- Automated reconciliation
- Revenue analytics dashboard
- Subscription tier management
- Free trial implementation
- Promo code system

Compliance:
- KYC/AML integration
- Tax calculation (US, EU, UK)
- GDPR compliant data handling

Testing includes sandbox and mainnet validation.`,
    category: 'payment_integration',
    tags: ['stripe', 'cryptocurrency', 'payments', 'web3', 'fintech', 'saas'],
    location: 'Remote',
    budget: {
      min: 8000,
      max: 18000,
      currency: 'USD'
    },
    requiredSkills: ['Stripe API', 'Web3', 'Cryptocurrency', 'Payment Processing', 'Ring Platform', 'Node.js'],
    priority: 'urgent',
    visibility: 'public',
    status: 'active',
    applicantCount: 0
  }
];

// Helper function to create opportunities in database
export async function seedRingCustomizationOpportunities() {
  // This function would be called from a seed script or admin interface
  // Implementation depends on your database setup
  console.log(`Ready to seed ${seedRingOpportunities.length} Ring customization opportunities`);
  return seedRingOpportunities;
}
