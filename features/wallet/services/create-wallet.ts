// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { auth } from '@/auth';
import { UserRole, Wallet } from '@/features/auth/types';
// ethers.js removed - wallets now created via wagmi/RainbowKit UI

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getDatabaseService, initializeDatabase } from '@/lib/database';

/**
 * Legacy wallet creation service - DEPRECATED
 *
 * Wallets are now created via wagmi/RainbowKit UI in React components.
 * This service is kept for backward compatibility but should not be used.
 *
 * New approach:
 * 1. Users connect wallets via RainbowKit in the UI
 * 2. Wallet addresses are stored in the database
 * 3. Private keys are never stored server-side
 *
 * @deprecated Use wagmi/RainbowKit wallet connection instead
 * @param {string} [label] - Optional label for the new wallet.
 * @returns {Promise<Wallet>} A promise that resolves to the newly created Wallet object.
 * @throws {Error} If the user is not authenticated, if wallet creation fails, or if there's any other error during the process.
 */
export async function createWallet(label?: string): Promise<Wallet> {
  throw new Error('DEPRECATED: Wallet creation now handled by wagmi/RainbowKit UI. Use wallet connection instead of server-side wallet creation.')
}
