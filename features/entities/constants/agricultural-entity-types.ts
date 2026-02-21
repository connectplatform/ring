/**
 * GreenFood.live Agricultural Entity Types
 * 
 * Comprehensive ERP field definitions for agricultural marketplace
 * Each entity type has 40-85+ specialized fields for operational excellence
 */

export const AGRICULTURAL_ENTITY_TYPES = {
  FARM: {
    id: 'farm',
    name: 'Farm & Agricultural Producer',
    icon: '🌾',
    description: 'Farms, ranches, and agricultural producers',
    requiredFields: [
      'farmSize',
      'crops',
      'certifications',
      'farmingMethods',
      'harvestSchedule',
    ],
    erpFields: {
      // ============================================================================
      // OPERATIONAL (10 fields)
      // ============================================================================
      farmSize: {
        type: 'number',
        label: 'Farm Size (hectares)',
        required: true,
        validation: { min: 0.1, max: 100000 },
      },
      cropTypes: {
        type: 'array',
        label: 'Crop Types',
        required: true,
        options: [
          'Vegetables',
          'Fruits',
          'Grains',
          'Legumes',
          'Nuts',
          'Herbs',
          'Flowers',
          'Hemp',
          'Other',
        ],
      },
      farmingMethod: {
        type: 'enum',
        label: 'Primary Farming Method',
        required: true,
        options: [
          'organic',
          'conventional',
          'regenerative',
          'biodynamic',
          'permaculture',
          'hydroponic',
          'aquaponic',
        ],
      },
      annualProduction: {
        type: 'number',
        label: 'Annual Production (kg)',
        unit: 'kg',
      },
      seasonalAvailability: {
        type: 'object',
        label: 'Seasonal Availability',
        schema: {
          spring: { type: 'array', items: 'string' },
          summer: { type: 'array', items: 'string' },
          fall: { type: 'array', items: 'string' },
          winter: { type: 'array', items: 'string' },
        },
      },
      harvestSchedule: {
        type: 'object',
        label: 'Harvest Schedule',
        schema: {
          nextHarvest: 'date',
          frequency: 'string',
          estimatedYield: 'number',
        },
      },
      laborForce: {
        type: 'number',
        label: 'Number of Workers',
      },
      machineryCount: {
        type: 'number',
        label: 'Farm Equipment Count',
      },
      irrigationMethod: {
        type: 'enum',
        options: ['drip', 'sprinkler', 'flood', 'rain-fed', 'mixed'],
      },
      farmEstablishedYear: {
        type: 'number',
        label: 'Year Farm Established',
        validation: { min: 1800, max: 2025 },
      },

      // ============================================================================
      // CERTIFICATIONS (8 fields)
      // ============================================================================
      organicCertification: {
        type: 'enum',
        label: 'Organic Certification',
        options: ['USDA', 'EU-Organic', 'Biodynamic', 'Other', 'None'],
      },
      organicCertNumber: {
        type: 'string',
        label: 'Organic Certification Number',
        conditional: { field: 'organicCertification', ne: 'None' },
      },
      certificationExpiry: {
        type: 'date',
        label: 'Certification Expiry Date',
      },
      fairTradeCertified: {
        type: 'boolean',
        label: 'Fair Trade Certified',
        default: false,
      },
      nonGMO: {
        type: 'boolean',
        label: 'Non-GMO Verified',
        default: false,
      },
      animalWelfareCertified: {
        type: 'boolean',
        label: 'Animal Welfare Certified',
        default: false,
      },
      globalGAPCertified: {
        type: 'boolean',
        label: 'GlobalG.A.P. Certified',
        default: false,
      },
      certificationDocuments: {
        type: 'array',
        label: 'Certification Documents',
        items: {
          type: 'file',
          accept: 'application/pdf,image/*',
        },
      },

      // ============================================================================
      // SUSTAINABILITY (12 fields)
      // ============================================================================
      regenerativeScore: {
        type: 'number',
        label: 'Regenerative Agriculture Score',
        validation: { min: 0, max: 100 },
        calculated: true,
      },
      carbonFootprint: {
        type: 'number',
        label: 'Carbon Footprint (kg CO2/product)',
        unit: 'kg CO2',
      },
      waterUsage: {
        type: 'number',
        label: 'Water Usage (liters/product)',
        unit: 'liters',
      },
      soilHealthScore: {
        type: 'number',
        label: 'Soil Health Score',
        validation: { min: 0, max: 100 },
      },
      biodiversityIndex: {
        type: 'number',
        label: 'Biodiversity Index',
        validation: { min: 0, max: 100 },
      },
      renewableEnergyPercent: {
        type: 'number',
        label: 'Renewable Energy Usage (%)',
        validation: { min: 0, max: 100 },
        unit: '%',
      },
      wasteReduction: {
        type: 'number',
        label: 'Waste Reduction (%)',
        validation: { min: 0, max: 100 },
        unit: '%',
      },
      plasticFreePackaging: {
        type: 'boolean',
        label: 'Plastic-Free Packaging',
        default: false,
      },
      coverCropping: {
        type: 'boolean',
        label: 'Uses Cover Cropping',
        default: false,
      },
      composting: {
        type: 'boolean',
        label: 'On-Site Composting',
        default: false,
      },
      waterConservation: {
        type: 'string',
        label: 'Water Conservation Methods',
        multiline: true,
      },
      carbonSequestration: {
        type: 'number',
        label: 'Carbon Sequestration (tons/year)',
        unit: 'tons CO2/year',
      },

      // ============================================================================
      // TRACEABILITY (15 fields)
      // ============================================================================
      fsmaCompliant: {
        type: 'boolean',
        label: 'FSMA 204 Compliant',
        default: false,
      },
      traceabilityLotCode: {
        type: 'string',
        label: 'Traceability Lot Code (TLC)',
        format: 'YYYY-MM-DD-FARM-BATCH',
      },
      globalLocationNumber: {
        type: 'string',
        label: 'Global Location Number (GLN)',
        format: '13-digit GLN',
      },
      harvestCoordinates: {
        type: 'coordinates',
        label: 'Harvest Location GPS',
        schema: {
          lat: 'number',
          lng: 'number',
          address: 'string',
        },
      },
      blockchainTraceability: {
        type: 'boolean',
        label: 'Blockchain Traceability Enabled',
        default: false,
      },
      blockchainHash: {
        type: 'string',
        label: 'Blockchain Transaction Hash',
        conditional: { field: 'blockchainTraceability', eq: true },
      },
      smartContractAddress: {
        type: 'string',
        label: 'Smart Contract Address',
        conditional: { field: 'blockchainTraceability', eq: true },
      },
      iotSensors: {
        type: 'boolean',
        label: 'IoT Sensors Deployed',
        default: false,
      },
      iotDeviceIds: {
        type: 'array',
        label: 'IoT Device IDs',
        items: 'string',
        conditional: { field: 'iotSensors', eq: true },
      },
      temperatureMonitoring: {
        type: 'boolean',
        label: 'Temperature Monitoring',
        default: false,
      },
      humidityMonitoring: {
        type: 'boolean',
        label: 'Humidity Monitoring',
        default: false,
      },
      traceabilityPlatform: {
        type: 'enum',
        label: 'Traceability Platform',
        options: ['IBM Food Trust', 'Walmart Eden', 'GS1', 'Custom', 'None'],
      },
      batchTracking: {
        type: 'boolean',
        label: 'Batch-Level Tracking',
        default: true,
      },
      recallProcedure: {
        type: 'string',
        label: 'Product Recall Procedure',
        multiline: true,
      },
      lastAuditDate: {
        type: 'date',
        label: 'Last Traceability Audit',
      },

      // ============================================================================
      // SUPPLY CHAIN (10 fields)
      // ============================================================================
      distributionRadius: {
        type: 'number',
        label: 'Distribution Radius (km)',
        unit: 'km',
        default: 100,
      },
      deliveryMethods: {
        type: 'array',
        label: 'Delivery Methods',
        options: ['Own transport', 'Third-party courier', 'Farmers market', 'Pickup', 'Mail'],
      },
      storageCapacity: {
        type: 'number',
        label: 'Storage Capacity (cubic meters)',
        unit: 'm³',
      },
      coldStorageAvailable: {
        type: 'boolean',
        label: 'Cold Storage Available',
        default: false,
      },
      coldStorageCapacity: {
        type: 'number',
        label: 'Cold Storage Capacity (cubic meters)',
        unit: 'm³',
        conditional: { field: 'coldStorageAvailable', eq: true },
      },
      packagingOptions: {
        type: 'array',
        label: 'Packaging Options',
        options: ['Bulk', 'Pre-packaged', 'Custom', 'Compostable', 'Reusable containers'],
      },
      minimumOrder: {
        type: 'number',
        label: 'Minimum Order (kg)',
        unit: 'kg',
      },
      leadTime: {
        type: 'number',
        label: 'Order Lead Time (days)',
        unit: 'days',
      },
      wholesaleAvailable: {
        type: 'boolean',
        label: 'Wholesale Available',
        default: false,
      },
      csaProgram: {
        type: 'boolean',
        label: 'CSA (Community Supported Agriculture) Program',
        default: false,
      },

      // ============================================================================
      // QUALITY CONTROL (8 fields)
      // ============================================================================
      qualityScore: {
        type: 'number',
        label: 'Quality Score',
        validation: { min: 0, max: 100 },
        calculated: true,
      },
      inspectionFrequency: {
        type: 'enum',
        label: 'Inspection Frequency',
        options: ['weekly', 'monthly', 'quarterly', 'annual'],
      },
      lastInspectionDate: {
        type: 'date',
        label: 'Last Inspection Date',
      },
      qualityViolations: {
        type: 'number',
        label: 'Quality Violations (Last 12 Months)',
        default: 0,
      },
      testingLab: {
        type: 'string',
        label: 'Testing Laboratory Name',
      },
      residueTestingFrequency: {
        type: 'enum',
        label: 'Pesticide Residue Testing',
        options: ['every-batch', 'monthly', 'quarterly', 'annual', 'none'],
      },
      heavyMetalTesting: {
        type: 'boolean',
        label: 'Heavy Metal Testing',
        default: false,
      },
      pathogenTesting: {
        type: 'boolean',
        label: 'Pathogen Testing',
        default: false,
      },

      // ============================================================================
      // FINANCIAL (10 fields)
      // ============================================================================
      pricingStrategy: {
        type: 'enum',
        label: 'Pricing Strategy',
        options: ['premium', 'value', 'competitive', 'dynamic'],
      },
      acceptsTokenPayments: {
        type: 'boolean',
        label: 'Accepts DAAR/DAARION Tokens',
        default: false,
      },
      daarWalletAddress: {
        type: 'string',
        label: 'DAAR Wallet Address',
        format: '0x...',
        conditional: { field: 'acceptsTokenPayments', eq: true },
      },
      daarionStaked: {
        type: 'number',
        label: 'DAARION Tokens Staked',
        unit: 'DAARION',
        default: 0,
      },
      tokenDiscountPercent: {
        type: 'number',
        label: 'Token Payment Discount (%)',
        validation: { min: 0, max: 50 },
        unit: '%',
        default: 5,
      },
      annualRevenue: {
        type: 'number',
        label: 'Annual Revenue (USD)',
        unit: 'USD',
        confidential: true,
      },
      profitMargin: {
        type: 'number',
        label: 'Profit Margin (%)',
        validation: { min: -100, max: 100 },
        unit: '%',
        confidential: true,
      },
      insuranceCoverage: {
        type: 'boolean',
        label: 'Crop Insurance Coverage',
        default: false,
      },
      bankingPartner: {
        type: 'string',
        label: 'Banking Partner',
      },
      acceptsPreOrders: {
        type: 'boolean',
        label: 'Accepts Pre-Orders',
        default: false,
      },

      // ============================================================================
      // COMMUNITY (7 fields)
      // ============================================================================
      farmVisitsEnabled: {
        type: 'boolean',
        label: 'Farm Tours Available',
        default: false,
      },
      uPickAvailable: {
        type: 'boolean',
        label: 'U-Pick Available',
        default: false,
      },
      csaOffered: {
        type: 'boolean',
        label: 'CSA Program Offered',
        default: false,
      },
      educationalPrograms: {
        type: 'boolean',
        label: 'Educational Programs Offered',
        default: false,
      },
      localJobsCreated: {
        type: 'number',
        label: 'Local Jobs Created',
        default: 0,
      },
      communityEvents: {
        type: 'number',
        label: 'Community Events (Annual)',
        default: 0,
      },
      socialMediaPresence: {
        type: 'object',
        label: 'Social Media',
        schema: {
          facebook: 'string',
          instagram: 'string',
          twitter: 'string',
          website: 'string',
        },
      },

      // ============================================================================
      // AI INTEGRATION (5 fields)
      // ============================================================================
      dagiAgentTier: {
        type: 'enum',
        label: 'DAGI Agent Tier',
        options: [1, 2, 3],
        description: 'Stage 1 (100 DAARION), Stage 2 (500 DAARION), Stage 3 (2000 DAARION)',
        default: 1,
      },
      dagiAgentId: {
        type: 'string',
        label: 'DAGI Agent ID',
        readonly: true,
      },
      daarwizzSyncEnabled: {
        type: 'boolean',
        label: 'DAARWIZZ Knowledge Sync',
        default: true,
      },
      aiAutomationLevel: {
        type: 'number',
        label: 'AI Automation Level (%)',
        validation: { min: 0, max: 100 },
        unit: '%',
        calculated: true,
      },
      predictionAccuracy: {
        type: 'number',
        label: 'Yield Prediction Accuracy (%)',
        validation: { min: 0, max: 100 },
        unit: '%',
        calculated: true,
      },
    },
  },

  FOOD_PRODUCER: {
    id: 'food-producer',
    name: 'Food Producer & Processor',
    icon: '🏭',
    description: 'Food processing facilities, manufacturers, and value-added producers',
    requiredFields: [
      'productionCapacity',
      'certifications',
      'processingMethods',
      'productCategories',
    ],
    erpFields: {
      // 40+ similar ERP fields for food processors
      productionCapacity: {
        type: 'number',
        label: 'Production Capacity (units/day)',
        unit: 'units/day',
        required: true,
      },
      processingMethods: {
        type: 'array',
        label: 'Processing Methods',
        options: [
          'Freezing',
          'Canning',
          'Drying',
          'Fermentation',
          'Smoking',
          'Juicing',
          'Milling',
          'Roasting',
          'Distilling',
          'Other',
        ],
      },
      productCategories: {
        type: 'array',
        label: 'Product Categories',
        options: [
          'Dairy',
          'Beverages',
          'Baked Goods',
          'Preserves',
          'Sauces',
          'Snacks',
          'Ready Meals',
          'Supplements',
          'Other',
        ],
      },
      haccpCertified: {
        type: 'boolean',
        label: 'HACCP Certified',
        default: false,
      },
      fdaRegistered: {
        type: 'boolean',
        label: 'FDA Registered',
        default: false,
      },
      allergenHandling: {
        type: 'array',
        label: 'Allergen Handling Protocols',
        options: ['Gluten', 'Dairy', 'Nuts', 'Soy', 'Eggs', 'Shellfish', 'Fish', 'Sesame'],
      },
      shelfLife: {
        type: 'number',
        label: 'Average Shelf Life (days)',
        unit: 'days',
      },
      copackingAvailable: {
        type: 'boolean',
        label: 'Co-Packing Services Available',
        default: false,
      },
      privateLabelOffered: {
        type: 'boolean',
        label: 'Private Label Services',
        default: false,
      },
      minimumBatchSize: {
        type: 'number',
        label: 'Minimum Batch Size',
        unit: 'units',
      },
    },
  },

  FARMERS_MARKET: {
    id: 'farmers-market',
    name: 'Farmers Market',
    icon: '🏪',
    description: 'Physical farmers markets and community markets',
    requiredFields: ['location', 'schedule', 'vendorCount'],
    erpFields: {
      marketLocation: {
        type: 'address',
        label: 'Market Location',
        required: true,
      },
      marketSchedule: {
        type: 'object',
        label: 'Market Schedule',
        schema: {
          daysOpen: { type: 'array', items: 'string' },
          hours: 'string',
          seasonal: 'boolean',
          openDates: { type: 'array', items: 'date' },
        },
      },
      vendorCount: {
        type: 'number',
        label: 'Number of Vendors',
        default: 0,
      },
      acceptsCreditCards: {
        type: 'boolean',
        label: 'Accepts Credit Cards',
        default: false,
      },
      acceptsTokens: {
        type: 'boolean',
        label: 'Accepts DAAR/DAARION Tokens',
        default: false,
      },
      parkingAvailable: {
        type: 'boolean',
        label: 'Parking Available',
        default: true,
      },
      wheelchairAccessible: {
        type: 'boolean',
        label: 'Wheelchair Accessible',
        default: true,
      },
    },
  },

  ARTISAN_PRODUCER: {
    id: 'artisan',
    name: 'Artisan Food Maker',
    icon: '🧀',
    description: 'Artisan cheese makers, bakers, preservers, and craft food producers',
    requiredFields: ['specialties', 'productionMethods'],
    erpFields: {
      specialties: {
        type: 'array',
        label: 'Specialties',
        options: [
          'Cheese',
          'Bread',
          'Pastries',
          'Preserves',
          'Honey',
          'Chocolate',
          'Coffee',
          'Wine',
          'Beer',
          'Spirits',
          'Charcuterie',
          'Pickles',
          'Sauces',
          'Other',
        ],
      },
      handmade: {
        type: 'boolean',
        label: 'Handmade Products',
        default: true,
      },
      smallBatchProduction: {
        type: 'boolean',
        label: 'Small Batch Production',
        default: true,
      },
      awardWinning: {
        type: 'boolean',
        label: 'Award-Winning Products',
        default: false,
      },
      awards: {
        type: 'array',
        label: 'Awards & Recognition',
        items: {
          type: 'object',
          schema: {
            name: 'string',
            year: 'number',
            product: 'string',
          },
        },
      },
    },
  },

  COOPERATIVE: {
    id: 'cooperative',
    name: 'Agricultural Cooperative',
    icon: '🤝',
    description: 'Farmer cooperatives and collective agricultural enterprises',
    requiredFields: ['memberCount', 'cooperativeType', 'governance'],
    erpFields: {
      // ============================================================================
      // GOVERNANCE (15 fields)
      // ============================================================================
      governanceModel: {
        type: 'enum',
        label: 'Governance Model',
        options: ['democratic', 'representative', 'consensus'],
        required: true,
      },
      votingSystem: {
        type: 'enum',
        label: 'Voting System',
        options: ['one_member_one_vote', 'shares_based', 'token_weighted'],
      },
      boardSize: {
        type: 'number',
        label: 'Board of Directors Size',
        validation: { min: 3, max: 21 },
      },
      electionFrequency: {
        type: 'enum',
        label: 'Election Frequency',
        options: ['annual', 'biannual', 'every_two_years'],
      },
      proposalThreshold: {
        type: 'number',
        label: 'Proposal Threshold (% members)',
        validation: { min: 1, max: 100 },
        unit: '%',
        default: 10,
      },
      quorumRequirement: {
        type: 'number',
        label: 'Quorum Requirement (%)',
        validation: { min: 1, max: 100 },
        unit: '%',
        default: 50,
      },
      passingThreshold: {
        type: 'number',
        label: 'Passing Vote Threshold (%)',
        validation: { min: 50, max: 100 },
        unit: '%',
        default: 66,
      },
      smartContractGovernance: {
        type: 'boolean',
        label: 'Smart Contract Governance',
        default: false,
      },
      governanceTokenAddress: {
        type: 'string',
        label: 'Governance Token Contract',
        conditional: { field: 'smartContractGovernance', eq: true },
      },
      daoEnabled: {
        type: 'boolean',
        label: 'DAO (Decentralized Autonomous Organization)',
        default: false,
      },
      microDAOEnabled: {
        type: 'boolean',
        label: 'microDAO Integration (DAARION.city)',
        default: false,
      },
      proposalCreationOpen: {
        type: 'boolean',
        label: 'Open Proposal Creation',
        default: true,
      },
      bylawsDocument: {
        type: 'file',
        label: 'Cooperative Bylaws',
        accept: 'application/pdf',
      },
      lastGeneralMeeting: {
        type: 'date',
        label: 'Last General Meeting',
      },
      nextGeneralMeeting: {
        type: 'date',
        label: 'Next General Meeting',
      },

      // ============================================================================
      // MEMBERSHIP (12 fields)
      // ============================================================================
      memberCount: {
        type: 'number',
        label: 'Total Member Count',
        required: true,
        default: 0,
      },
      activeMemberCount: {
        type: 'number',
        label: 'Active Member Count',
        calculated: true,
      },
      membershipFee: {
        type: 'number',
        label: 'Membership Fee (Annual)',
        unit: 'USD',
      },
      memberEquity: {
        type: 'array',
        label: 'Member Equity Distribution',
        items: {
          type: 'object',
          schema: {
            memberId: 'string',
            equityPercent: 'number',
            investmentAmount: 'number',
          },
        },
        confidential: true,
      },
      patronageRefunds: {
        type: 'boolean',
        label: 'Patronage Refunds Enabled',
        default: true,
      },
      memberBenefits: {
        type: 'array',
        label: 'Member Benefits',
        options: [
          'Bulk purchasing discounts',
          'Shared equipment access',
          'Marketing support',
          'Technical assistance',
          'Training programs',
          'Insurance coverage',
          'Storage facilities',
          'Processing facilities',
        ],
      },
      newMemberApplication: {
        type: 'boolean',
        label: 'Accepting New Members',
        default: true,
      },
      membershipCriteria: {
        type: 'string',
        label: 'Membership Criteria',
        multiline: true,
      },
      memberRetentionRate: {
        type: 'number',
        label: 'Member Retention Rate (%)',
        validation: { min: 0, max: 100 },
        unit: '%',
        calculated: true,
      },
      memberTrainingHours: {
        type: 'number',
        label: 'Member Training Hours (Annual)',
        unit: 'hours',
      },
      memberDemographics: {
        type: 'object',
        label: 'Member Demographics',
        schema: {
          averageAge: 'number',
          genderDistribution: 'object',
          averageFarmSize: 'number',
        },
        confidential: true,
      },
      memberDirectory: {
        type: 'boolean',
        label: 'Public Member Directory',
        default: false,
      },

      // ============================================================================
      // FINANCIAL (18 fields)
      // ============================================================================
      sharedRevenue: {
        type: 'number',
        label: 'Total Shared Revenue (Annual)',
        unit: 'USD',
        confidential: true,
      },
      revenueDistribution: {
        type: 'enum',
        label: 'Revenue Distribution Model',
        options: ['equal', 'equity_based', 'patronage', 'hybrid'],
      },
      reserveFund: {
        type: 'number',
        label: 'Reserve Fund Balance',
        unit: 'USD',
        confidential: true,
      },
      memberDividends: {
        type: 'number',
        label: 'Member Dividends (Last Year)',
        unit: 'USD',
        confidential: true,
      },
      patronageRefundRate: {
        type: 'number',
        label: 'Patronage Refund Rate (%)',
        validation: { min: 0, max: 100 },
        unit: '%',
        default: 20,
      },
      sharedExpenses: {
        type: 'object',
        label: 'Shared Expenses',
        schema: {
          marketing: 'number',
          facilities: 'number',
          equipment: 'number',
          insurance: 'number',
          administration: 'number',
        },
        confidential: true,
      },
      costSavingsGenerated: {
        type: 'number',
        label: 'Cost Savings Generated (Annual)',
        unit: 'USD',
      },
      bulkPurchasingVolume: {
        type: 'number',
        label: 'Bulk Purchasing Volume (Annual)',
        unit: 'USD',
      },
      collectiveBargaining: {
        type: 'boolean',
        label: 'Collective Bargaining Power',
        default: true,
      },
      financialTransparency: {
        type: 'boolean',
        label: 'Financial Transparency Policy',
        default: true,
      },
      annualAuditRequired: {
        type: 'boolean',
        label: 'Annual Audit Required',
        default: true,
      },
      lastAuditDate: {
        type: 'date',
        label: 'Last Financial Audit',
      },
      profitMarginTarget: {
        type: 'number',
        label: 'Target Profit Margin (%)',
        validation: { min: 0, max: 100 },
        unit: '%',
      },
      capitalInvestments: {
        type: 'array',
        label: 'Capital Investments',
        items: {
          type: 'object',
          schema: {
            description: 'string',
            amount: 'number',
            date: 'date',
            fundingSource: 'string',
          },
        },
      },
      loansFacilitated: {
        type: 'number',
        label: 'Loans Facilitated to Members',
        unit: 'USD',
      },
      grantsFunded: {
        type: 'number',
        label: 'Grants Received (Cumulative)',
        unit: 'USD',
      },
      subsidiesReceived: {
        type: 'number',
        label: 'Government Subsidies (Annual)',
        unit: 'USD',
        confidential: true,
      },
      financialReportPublic: {
        type: 'boolean',
        label: 'Public Financial Reports',
        default: false,
      },

      // ============================================================================
      // OPERATIONS (10 fields)
      // ============================================================================
      sharedFacilities: {
        type: 'array',
        label: 'Shared Facilities',
        options: [
          'Processing plant',
          'Cold storage',
          'Warehouse',
          'Packaging facility',
          'Farm store',
          'Distribution center',
          'Meeting hall',
          'Training center',
        ],
      },
      equipmentPool: {
        type: 'array',
        label: 'Shared Equipment',
        options: [
          'Tractors',
          'Harvesters',
          'Seeders',
          'Irrigation systems',
          'Processing equipment',
          'Packaging machines',
          'Transportation vehicles',
        ],
      },
      bulkPurchasing: {
        type: 'boolean',
        label: 'Bulk Purchasing Program',
        default: true,
      },
      collectiveMarketing: {
        type: 'boolean',
        label: 'Collective Marketing',
        default: true,
      },
      brandName: {
        type: 'string',
        label: 'Cooperative Brand Name',
      },
      certifications: {
        type: 'array',
        label: 'Cooperative Certifications',
        options: ['Fair Trade', 'Organic', 'B-Corp', 'Cooperative Identity', 'Other'],
      },
      technicalAssistance: {
        type: 'boolean',
        label: 'Technical Assistance Program',
        default: false,
      },
      researchCollaboration: {
        type: 'boolean',
        label: 'Research Collaboration',
        default: false,
      },
      knowledgeSharing: {
        type: 'boolean',
        label: 'Knowledge Sharing Platform',
        default: true,
      },
      innovationFund: {
        type: 'number',
        label: 'Innovation Fund Balance',
        unit: 'USD',
      },

      // ============================================================================
      // TOKEN ECONOMY (15 fields)
      // ============================================================================
      cooperativeToken: {
        type: 'string',
        label: 'Cooperative Token Symbol',
        description: 'Custom token for internal economy',
      },
      tokenContractAddress: {
        type: 'string',
        label: 'Token Contract Address',
        format: '0x...',
      },
      tokenomicsModel: {
        type: 'object',
        label: 'Tokenomics Model',
        schema: {
          totalSupply: 'number',
          distribution: 'object',
          utility: 'array',
          governance: 'boolean',
        },
      },
      memberStaking: {
        type: 'boolean',
        label: 'Member Staking Program',
        default: false,
      },
      stakingRewards: {
        type: 'number',
        label: 'Staking Rewards (APY %)',
        validation: { min: 0, max: 100 },
        unit: '%',
      },
      rewardDistribution: {
        type: 'enum',
        label: 'Reward Distribution',
        options: ['automatic', 'manual', 'proposal_based'],
      },
      liquidityPool: {
        type: 'boolean',
        label: 'Liquidity Pool Enabled',
        default: false,
      },
      treasuryBalance: {
        type: 'number',
        label: 'Token Treasury Balance',
        unit: 'tokens',
        confidential: true,
      },
      tokenBuyback: {
        type: 'boolean',
        label: 'Token Buyback Program',
        default: false,
      },
      burnMechanism: {
        type: 'boolean',
        label: 'Token Burn Mechanism',
        default: false,
      },
      yieldFarming: {
        type: 'boolean',
        label: 'Yield Farming Available',
        default: false,
      },
      nftMembership: {
        type: 'boolean',
        label: 'NFT Membership Tokens',
        default: false,
      },
      daarIntegration: {
        type: 'boolean',
        label: 'DAAR Token Integration',
        default: false,
      },
      daarionIntegration: {
        type: 'boolean',
        label: 'DAARION Token Integration',
        default: false,
      },
      crossChainBridging: {
        type: 'boolean',
        label: 'Cross-Chain Bridging',
        default: false,
      },

      // ============================================================================
      // DAARION INTEGRATION (8 fields)
      // ============================================================================
      dagiCoordinatorAgent: {
        type: 'string',
        label: 'DAGI Coordinator Agent ID',
        description: 'Collective AI agent for cooperative',
      },
      collectiveAILearning: {
        type: 'boolean',
        label: 'Collective AI Learning',
        default: false,
      },
      daarwizzSyncEnabled: {
        type: 'boolean',
        label: 'DAARWIZZ Knowledge Sync',
        default: false,
      },
      sharedKnowledgeGraph: {
        type: 'boolean',
        label: 'Shared Knowledge Graph',
        default: false,
      },
      aiDecisionSupport: {
        type: 'boolean',
        label: 'AI Decision Support System',
        default: false,
      },
      predictiveAnalytics: {
        type: 'boolean',
        label: 'Predictive Analytics',
        default: false,
      },
      multiAgentCoordination: {
        type: 'boolean',
        label: 'Multi-Agent Coordination',
        description: 'Coordinate DAGI agents across member farms',
        default: false,
      },
    },
  },
} as const

export type AgriculturalEntityType = keyof typeof AGRICULTURAL_ENTITY_TYPES

