/**
 * Wallet Service - Project-Specific Wallet Management (legacy project_wallets layer)
 * Contact CRUD moved to RingContactsService / ring_contacts (2026-06).
 */

import { cache } from 'react';
import {
  WalletAccount,
  WalletTransaction,
  ProjectWalletData
} from '@/features/wallet/types';
import { db } from '@/lib/database';

type ProjectWalletRow = {
  address?: string;
  primary?: boolean;
  label?: string;
  created_at?: string;
  createdAt?: string;
};

function toWalletDbRow(
  globalUserId: string,
  projectSlug: string,
  wallet: ProjectWalletData
): Record<string, unknown> {
  return {
    id: wallet.id,
    global_user_id: globalUserId,
    project_slug: projectSlug,
    address: wallet.address,
    primary: wallet.primary,
    label: wallet.label,
    encrypted_private_key: wallet.encryptedPrivateKey,
    public_key: wallet.publicKey,
    network_id: wallet.networkId,
    created_at: wallet.createdAt instanceof Date ? wallet.createdAt.toISOString() : wallet.createdAt,
    last_used: wallet.lastUsed instanceof Date ? wallet.lastUsed.toISOString() : wallet.lastUsed,
  };
}

/**
 * Project-specific wallet service implementation
 * Manages isolated wallet data per project while maintaining global user identity
 */
class WalletServiceImpl {
  private projectSlug: string;

  constructor(projectSlug: string = 'ring_platform') {
    this.projectSlug = projectSlug;
  }

  // ============================================================================
  // WALLET MANAGEMENT - PER-PROJECT
  // ============================================================================

  /**
   * Create or get wallet for user in this project
   */
  async ensureProjectWallet(globalUserId: string): Promise<WalletAccount> {
    console.log(`🏦 WalletService - Ensuring wallet for user ${globalUserId} in project ${this.projectSlug}`);

    try {
      const existingResult = await db().queryDocs<ProjectWalletRow>({
        collection: 'project_wallets',
        filters: [
          { field: 'global_user_id', operator: '==', value: globalUserId },
          { field: 'project_slug', operator: '==', value: this.projectSlug }
        ]
      });

      if (!existingResult.success) {
        throw new Error(`Failed to query project wallets: ${existingResult.error}`);
      }

      if (existingResult.data.length > 0) {
        const existingWallet = existingResult.data[0];
        return {
          address: existingWallet.address ?? '',
          primary: existingWallet.primary || false,
          label: existingWallet.label || `${this.projectSlug} Wallet`,
          createdAt: existingWallet.created_at ?? existingWallet.createdAt
        };
      }

      // Create new wallet for this project
      const walletAddress = this.generateWalletAddress();

      const walletData: ProjectWalletData = {
        id: crypto.randomUUID(),
        globalUserId,
        projectSlug: this.projectSlug,
        address: walletAddress,
        primary: true,
        label: `${this.projectSlug} Wallet`,
        createdAt: new Date(),
        encryptedPrivateKey: await this.encryptPrivateKey(walletAddress),
        publicKey: this.generatePublicKey(walletAddress),
        networkId: 1, // Ethereum mainnet
        lastUsed: new Date()
      };

      const result = await db().createDoc('project_wallets', toWalletDbRow(globalUserId, this.projectSlug, walletData));
      if (!result.success) {
        throw new Error(`Failed to create project wallet: ${result.error}`);
      }

      return {
        address: walletAddress,
        primary: true,
        label: `${this.projectSlug} Wallet`,
        createdAt: walletData.createdAt.toISOString()
      };

    } catch (error) {
      console.error('WalletService - Error ensuring project wallet:', error);
      throw error;
    }
  }

  /**
   * Get all wallets for user in this project
   */
  async getProjectWallets(globalUserId: string): Promise<WalletAccount[]> {
    console.log(`🏦 WalletService - Getting wallets for user ${globalUserId} in project ${this.projectSlug}`);

    try {
      const result = await db().queryDocs<ProjectWalletRow>({
        collection: 'project_wallets',
        filters: [
          { field: 'global_user_id', operator: '==', value: globalUserId },
          { field: 'project_slug', operator: '==', value: this.projectSlug }
        ],
        orderBy: [{ field: 'last_used', direction: 'desc' as const }]
      });

      if (!result.success) {
        throw new Error(`Failed to query project wallets: ${result.error}`);
      }

      return result.data.map(doc => ({
        address: doc.address ?? '',
        primary: doc.primary || false,
        label: doc.label || 'Wallet',
        createdAt: doc.created_at ?? doc.createdAt
      }));

    } catch (error) {
      console.error('WalletService - Error getting project wallets:', error);
      throw error;
    }
  }

  /**
   * Check if user has wallet in this project
   */
  async hasProjectWallet(globalUserId: string): Promise<boolean> {
    try {
      const wallets = await this.getProjectWallets(globalUserId);
      return wallets.length > 0;
    } catch (error) {
      console.error('WalletService - Error checking project wallet existence:', error);
      return false;
    }
  }

  // ============================================================================
  // TRANSACTION HISTORY - PER-PROJECT (legacy)
  // ============================================================================

  /**
   * Get transaction history for user in this project
   */
  async getTransactionHistory(globalUserId: string, limit: number = 20): Promise<WalletTransaction[]> {
    console.log(`📊 WalletService - Getting transaction history for user ${globalUserId} in project ${this.projectSlug}`);

    try {
      const result = await db().queryDocs<Record<string, unknown>>({
        collection: 'project_wallet_transactions',
        filters: [
          { field: 'global_user_id', operator: '==', value: globalUserId },
          { field: 'project_slug', operator: '==', value: this.projectSlug }
        ],
        orderBy: [{ field: 'timestamp', direction: 'desc' as const }],
        pagination: { limit }
      });

      if (!result.success) {
        throw new Error(`Failed to query transactions: ${result.error}`);
      }

      return result.data.map(doc => ({
        id: String(doc.id),
        timestamp: doc.timestamp as string,
        walletAddress: (doc.wallet_address ?? doc.walletAddress) as string,
        txHash: (doc.tx_hash ?? doc.txHash) as string,
        recipient: doc.recipient as string,
        amount: doc.amount as string,
        tokenSymbol: (doc.token_symbol ?? doc.tokenSymbol) as string,
        status: doc.status as WalletTransaction['status'],
        networkId: (doc.network_id ?? doc.networkId) as number,
        blockNumber: (doc.block_number ?? doc.blockNumber) as number,
        gasUsed: (doc.gas_used ?? doc.gasUsed) as string,
        gasPrice: (doc.gas_price ?? doc.gasPrice) as string,
        from: (doc.from_address ?? doc.from) as string,
        to: (doc.to_address ?? doc.to) as string,
        value: doc.value as string,
        type: (doc.transaction_type ?? doc.type) as WalletTransaction['type'],
        notes: doc.notes as string | undefined
      }));

    } catch (error) {
      console.error('WalletService - Error getting transaction history:', error);
      throw error;
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private generateWalletAddress(): string {
    return '0x' + Math.random().toString(16).substr(2, 40);
  }

  private generatePublicKey(address: string): string {
    return '04' + Math.random().toString(16).substr(2, 128);
  }

  private async encryptPrivateKey(address: string): Promise<string> {
    return 'encrypted_' + Math.random().toString(36).substr(2, 64);
  }
}

/**
 * Factory function to create project-specific wallet service
 */
export const createWalletService = cache((projectSlug: string): WalletServiceImpl => {
  return new WalletServiceImpl(projectSlug);
});

/**
 * Get the current project's wallet service
 */
export const getCurrentWalletService = cache((): WalletServiceImpl => {
  const projectSlug = process.env.NEXT_PUBLIC_PROJECT_SLUG || 'ring_platform';
  return createWalletService(projectSlug);
});
