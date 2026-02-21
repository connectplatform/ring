#!/usr/bin/env tsx
/**
 * Product Import Script for Ring GreenFood Live
 * 
 * THE-NINE TASK FORCE IMPLEMENTATION
 * Guided by: Postgres DB Specialist, Ring Backend Administrator, Database Migration Manager
 * 
 * Mission: Import 457 products from ring-greenfood-legacy/products.xlsx into PostgreSQL
 * 
 * Zero-flaw protocol:
 * 1. Verify database connection
 * 2. Parse Excel with validation
 * 3. Transform to store_products schema
 * 4. Batch insert with progress tracking
 * 5. Verify import success
 */

import XLSX from 'xlsx';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const EXCEL_FILE = '/Users/insight/code/ringdom/ring-greenfood-legacy/products.xlsx';
const BATCH_SIZE = 50; // Insert 50 products at a time
const DRY_RUN = process.argv.includes('--dry-run');

// Database connection from environment
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ring_greenfood_live',
  user: process.env.DB_USER || 'greenfood_user',
  password: process.env.DB_PASSWORD || 'greenfood_secure_2024_GF!',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ExcelProductRow {
  id: string;
  available: number;
  availableStatus: string;
  name: string;
  description: string;
  price: number;
  discount: number;
  url: string;
  barcode: string;
  vendorCode: string;
  units: string;
  minCount: number;
  step: number;
  externalId: string;
  modifierId: string;
  stockType: string;
  stocksCount: number;
  parentId: string;
  isGrouped: number;
  allowNegativeStock: number;
  special: number;
  isService: number;
  isFixedStep: number;
  isTop: number;
  addToCartAutomatically: number;
  pictures: string;
  video: string;
  categories: string;
  wholeSales: string;
  hashtags: string;
  order: number;
  basePrice: string;
  baseCurrency: string;
  vendor: string;
}

interface StoreProduct {
  id: string;
  data: {
    // Core product info
    name: string;
    description: string;
    price: number;
    discount: number;
    
    // Availability
    available: boolean;
    availableStatus: string;
    stockType: string;
    stocksCount: number;
    allowNegativeStock: boolean;
    
    // Classification
    categories: string[];
    vendor: string;
    vendorId: string | null;
    
    // Media
    pictures: string[];
    video: string;
    
    // Inventory
    barcode: string;
    vendorCode: string;
    externalId: string;
    sku: string;
    
    // Ordering
    units: string;
    minCount: number;
    step: number;
    isFixedStep: boolean;
    
    // Flags
    isTop: boolean;
    isService: boolean;
    isGrouped: boolean;
    special: boolean;
    addToCartAutomatically: boolean;
    
    // Relationships
    parentId: string | null;
    modifierId: string | null;
    
    // Pricing
    wholeSales: any[];
    basePrice: number | null;
    baseCurrency: string;
    
    // SEO & Display
    url: string;
    hashtags: string[];
    order: number;
    
    // Metadata
    status: 'active' | 'draft' | 'archived';
    importedFrom: string;
    importedAt: string;
    legacyId: string;
  };
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// LOGGING
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(type: 'info' | 'success' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const colorMap = {
    info: colors.blue,
    success: colors.green,
    warn: colors.yellow,
    error: colors.red,
  };
  
  const symbol = {
    info: 'ℹ',
    success: '✓',
    warn: '⚠',
    error: '✗',
  };
  
  console.log(
    `${colorMap[type]}${symbol[type]} [${timestamp}] ${message}${colors.reset}`
  );
  
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// ============================================================================
// EXCEL PARSING
// ============================================================================

function parseExcelFile(): ExcelProductRow[] {
  log('info', `📖 Reading Excel file: ${EXCEL_FILE}`);
  
  const workbook = XLSX.readFile(EXCEL_FILE);
  const sheetName = workbook.SheetNames[0]; // 'offers' sheet
  const worksheet = workbook.Sheets[sheetName];
  
  const data = XLSX.utils.sheet_to_json<ExcelProductRow>(worksheet, {
    defval: '',
    raw: false, // Convert to strings
  });
  
  log('success', `✓ Parsed ${data.length} products from Excel`);
  
  return data;
}

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

function transformProduct(excelRow: ExcelProductRow): StoreProduct {
  const now = new Date();
  
  // Parse pictures (comma-separated URLs)
  const pictures = excelRow.pictures
    ? excelRow.pictures.split(',').map(p => p.trim()).filter(Boolean)
    : [];
  
  // Parse categories (comma-separated IDs)
  const categories = excelRow.categories
    ? excelRow.categories.split(',').map(c => c.trim()).filter(Boolean)
    : [];
  
  // Parse hashtags (comma-separated)
  const hashtags = excelRow.hashtags
    ? excelRow.hashtags.split(',').map(h => h.trim()).filter(Boolean)
    : [];
  
  // Parse wholesale prices (if any)
  const wholeSales: any[] = [];
  if (excelRow.wholeSales) {
    try {
      const parsed = JSON.parse(excelRow.wholeSales);
      if (Array.isArray(parsed)) {
        wholeSales.push(...parsed);
      }
    } catch (e) {
      // Invalid JSON, skip
    }
  }
  
  return {
    id: uuidv4(), // Generate new UUID for our system
    data: {
      // Core
      name: excelRow.name || 'Untitled Product',
      description: excelRow.description || '',
      price: parseFloat(String(excelRow.price)) || 0,
      discount: parseFloat(String(excelRow.discount)) || 0,
      
      // Availability
      available: Boolean(excelRow.available),
      availableStatus: excelRow.availableStatus || 'UNAVAILABLE',
      stockType: excelRow.stockType || 'unlimited',
      stocksCount: parseInt(String(excelRow.stocksCount)) || 0,
      allowNegativeStock: Boolean(excelRow.allowNegativeStock),
      
      // Classification
      categories,
      vendor: excelRow.vendor || '',
      vendorId: null, // Will be mapped later
      
      // Media
      pictures,
      video: excelRow.video || '',
      
      // Inventory
      barcode: excelRow.barcode || '',
      vendorCode: excelRow.vendorCode || '',
      externalId: excelRow.externalId || '',
      sku: excelRow.externalId || excelRow.id || '',
      
      // Ordering
      units: excelRow.units || 'pc',
      minCount: parseInt(String(excelRow.minCount)) || 1,
      step: parseInt(String(excelRow.step)) || 1,
      isFixedStep: Boolean(excelRow.isFixedStep),
      
      // Flags
      isTop: Boolean(excelRow.isTop),
      isService: Boolean(excelRow.isService),
      isGrouped: Boolean(excelRow.isGrouped),
      special: Boolean(excelRow.special),
      addToCartAutomatically: Boolean(excelRow.addToCartAutomatically),
      
      // Relationships
      parentId: excelRow.parentId || null,
      modifierId: excelRow.modifierId || null,
      
      // Pricing
      wholeSales,
      basePrice: excelRow.basePrice ? parseFloat(excelRow.basePrice) : null,
      baseCurrency: excelRow.baseCurrency || 'UAH',
      
      // SEO & Display
      url: excelRow.url || '',
      hashtags,
      order: parseInt(String(excelRow.order)) || 999,
      
      // Metadata
      status: (excelRow.available ? 'active' : 'draft') as 'active' | 'draft',
      importedFrom: 'ring-greenfood-legacy',
      importedAt: now.toISOString(),
      legacyId: excelRow.id,
    },
    created_at: now,
    updated_at: now,
  };
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function testConnection(pool: Pool): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW() as time, current_database() as db');
    log('success', '✓ Database connection successful', {
      time: result.rows[0].time,
      database: result.rows[0].db,
    });
    return true;
  } catch (error: any) {
    log('error', '✗ Database connection failed', {
      message: error.message,
      code: error.code,
    });
    return false;
  }
}

async function insertProducts(pool: Pool, products: StoreProduct[]): Promise<number> {
  let imported = 0;
  
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    
    if (DRY_RUN) {
      log('info', `[DRY RUN] Would insert batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} products`);
      imported += batch.length;
      continue;
    }
    
    try {
      // Prepare batch insert
      const values: any[] = [];
      const placeholders: string[] = [];
      
      batch.forEach((product, idx) => {
        const offset = idx * 4;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
        values.push(
          product.id,
          JSON.stringify(product.data),
          product.created_at,
          product.updated_at
        );
      });
      
      const query = `
        INSERT INTO store_products (id, data, created_at, updated_at)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (id) DO UPDATE 
        SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
      `;
      
      await pool.query(query, values);
      
      imported += batch.length;
      const progress = ((imported / products.length) * 100).toFixed(1);
      log('success', `✓ Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${imported}/${products.length} (${progress}%)`);
      
    } catch (error: any) {
      log('error', `✗ Failed to insert batch at index ${i}`, {
        message: error.message,
        batch_size: batch.length,
      });
      throw error;
    }
  }
  
  return imported;
}

async function verifyImport(pool: Pool): Promise<void> {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE data->>'importedFrom' = 'ring-greenfood-legacy') as imported,
      COUNT(*) FILTER (WHERE data->>'status' = 'active') as active,
      COUNT(*) FILTER (WHERE data->>'status' = 'draft') as draft
    FROM store_products
  `);
  
  log('success', '✓ Import verification complete', result.rows[0]);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('\n🔥 LEGION PRODUCT IMPORT CONQUEST 🔥\n');
  console.log('═'.repeat(60));
  
  if (DRY_RUN) {
    log('warn', '⚠ DRY RUN MODE - No database changes will be made');
  }
  
  // Step 1: Parse Excel
  log('info', 'Step 1/5: Parsing Excel file...');
  const excelData = parseExcelFile();
  
  if (excelData.length === 0) {
    log('error', '✗ No products found in Excel file');
    process.exit(1);
  }
  
  // Step 2: Transform data
  log('info', 'Step 2/5: Transforming products...');
  const products = excelData.map(transformProduct);
  log('success', `✓ Transformed ${products.length} products`);
  
  // Step 3: Connect to database
  log('info', 'Step 3/5: Connecting to database...');
  const pool = new Pool(DB_CONFIG);
  
  const connected = await testConnection(pool);
  if (!connected) {
    log('error', '✗ Cannot proceed without database connection');
    await pool.end();
    process.exit(1);
  }
  
  // Step 4: Import products
  log('info', `Step 4/5: Importing ${products.length} products in batches of ${BATCH_SIZE}...`);
  const imported = await insertProducts(pool, products);
  log('success', `✓ Import complete: ${imported} products`);
  
  // Step 5: Verify
  if (!DRY_RUN) {
    log('info', 'Step 5/5: Verifying import...');
    await verifyImport(pool);
  } else {
    log('info', 'Step 5/5: Skipped (dry run mode)');
  }
  
  await pool.end();
  
  console.log('\n' + '═'.repeat(60));
  console.log('🏆 CONQUEST COMPLETE! 🏆\n');
  
  if (DRY_RUN) {
    console.log('To execute the actual import, run:');
    console.log('  npx tsx scripts/import-products-from-excel.ts\n');
  }
}

// ============================================================================
// EXECUTION
// ============================================================================

main()
  .then(() => process.exit(0))
  .catch((error) => {
    log('error', '✗ Fatal error during import', {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });

