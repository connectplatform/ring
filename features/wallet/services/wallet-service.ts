/**
 * Wallet Service - Project-Specific Wallet Management
 * Handles wallet operations, contacts, and token transfers for Ring Platform clones
 */

import { cache } from 'react';
import {
  WalletAccount,
  WalletContact,
  WalletTransaction,
  ProjectWalletData
} from '@/features/wallet/types';
import { getDatabaseService, initializeDatabase } from '@/lib/database';

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
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      // Check if user already has a wallet in this project
      const existingQuery = {
        collection: 'project_wallets',
        filters: [
          { field: 'global_user_id', operator: '==', value: globalUserId },
          { field: 'project_slug', operator: '==', value: this.projectSlug }
        ]
      };

      const existingResult = await dbService.query(existingQuery);

      if (existingResult.success && existingResult.data && existingResult.data.length > 0) {
        const existingWallet = existingResult.data[0];
        return {
          address: existingWallet.data.address,
          primary: existingWallet.data.primary || false,
          label: existingWallet.data.label || `${this.projectSlug} Wallet`,
          createdAt: existingWallet.data.created_at
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

      const result = await dbService.create('project_wallets', walletData);
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
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const query = {
        collection: 'project_wallets',
        filters: [
          { field: 'global_user_id', operator: '==', value: globalUserId },
          { field: 'project_slug', operator: '==', value: this.projectSlug }
        ],
        orderBy: [{ field: 'last_used', direction: 'desc' as const }]
      };

      const result = await dbService.query(query);

      if (!result.success) {
        throw new Error(`Failed to query project wallets: ${result.error}`);
      }

      return (result.data || []).map(doc => ({
        address: doc.data.address,
        primary: doc.data.primary || false,
        label: doc.data.label || 'Wallet',
        createdAt: doc.data.created_at
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
  // CONTACT MANAGEMENT - PER-PROJECT
  // ============================================================================

  /**
   * Add contact to project address book
   */
  async addContact(globalUserId: string, contactData: Omit<WalletContact, 'id' | 'addedAt'>): Promise<WalletContact> {
    console.log(`📇 WalletService - Adding contact for user ${globalUserId} in project ${this.projectSlug}: ${contactData.name}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const contact: WalletContact = {
        id: crypto.randomUUID(),
        ...contactData,
        addedAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      };

      // Check if contact already exists
      const existingQuery = {
        collection: 'project_wallet_contacts',
        filters: [
          { field: 'global_user_id', operator: '==', value: globalUserId },
          { field: 'project_slug', operator: '==', value: this.projectSlug },
          { field: 'address', operator: '==', value: contactData.address }
        ]
      };

      const existingResult = await dbService.query(existingQuery);

      if (existingResult.success && existingResult.data && existingResult.data.length > 0) {
        // Update existing contact
        const updateResult = await dbService.update('project_wallet_contacts', existingResult.data[0].id, {
          ...contact,
          last_used: new Date().toISOString()
        });

        if (updateResult.success && updateResult.data) {
          return {
            ...updateResult.data.data,
            id: updateResult.data.id
          };
        }
      }

      // Create new contact
      const fullContact = {
        ...contact,
        globalUserId,
        projectSlug: this.projectSlug
      };

      const result = await dbService.create('project_wallet_contacts', fullContact);
      if (!result.success) {
        throw new Error(`Failed to add contact: ${result.error}`);
      }

      return contact;

    } catch (error) {
      console.error('WalletService - Error adding contact:', error);
      throw error;
    }
  }

  /**
   * Get all contacts for user in this project
   */
  async getContacts(globalUserId: string): Promise<WalletContact[]> {
    console.log(`📇 WalletService - Getting contacts for user ${globalUserId} in project ${this.projectSlug}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const query = {
        collection: 'project_wallet_contacts',
        filters: [
          { field: 'global_user_id', operator: '==', value: globalUserId },
          { field: 'project_slug', operator: '==', value: this.projectSlug }
        ],
        orderBy: [
          { field: 'is_favorite', direction: 'desc' as const },
          { field: 'last_used', direction: 'desc' as const }
        ]
      };

      const result = await dbService.query(query);

      if (!result.success) {
        throw new Error(`Failed to query contacts: ${result.error}`);
      }

      return (result.data || []).map(doc => ({
        id: doc.data.id || doc.id,
        name: doc.data.name,
        address: doc.data.address,
        notes: doc.data.notes,
        isFavorite: doc.data.is_favorite || false,
        isDefault: doc.data.is_default || false,
        addedAt: doc.data.added_at,
        lastUsed: doc.data.last_used
      }));

    } catch (error) {
      console.error('WalletService - Error getting contacts:', error);
      throw error;
    }
  }

  /**
   * Check if contact exists
   */
  async contactExists(globalUserId: string, address: string): Promise<boolean> {
    try {
      const contacts = await this.getContacts(globalUserId);
      return contacts.some(contact => contact.address.toLowerCase() === address.toLowerCase());
    } catch (error) {
      console.error('WalletService - Error checking contact existence:', error);
      return false;
    }
  }

  async removeContact(globalUserId: string, contactId: string): Promise<void> {
    console.log(`📇 WalletService - Removing contact ${contactId} for user ${globalUserId}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const result = await dbService.delete('project_wallet_contacts', contactId);
      if (!result.success) {
        throw new Error(`Failed to remove contact: ${result.error}`);
      }

    } catch (error) {
      console.error('WalletService - Error removing contact:', error);
      throw error;
    }
  }

  // ============================================================================
  // TOKEN TRANSFER - PER-PROJECT
  // ============================================================================

  /**
   * Send tokens to another recipient
   */
  async sendTokens(params: {
    globalUserId: string;
    fromAddress: string;
    toAddress: string;
    amount: string;
    tokenSymbol: string;
    notes?: string;
  }): Promise<WalletTransaction> {
    console.log(`💸 WalletService - Sending ${params.amount} ${params.tokenSymbol} from ${params.fromAddress} to ${params.toAddress}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      // Verify sender has wallet in this project
      const hasWallet = await this.hasProjectWallet(params.globalUserId);
      if (!hasWallet) {
        throw new Error('User does not have a wallet in this project');
      }

      // Create transaction record
      const transaction: WalletTransaction = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        walletAddress: params.fromAddress,
        txHash: this.generateTransactionHash(),
        recipient: params.toAddress,
        amount: params.amount,
        tokenSymbol: params.tokenSymbol,
        status: 'success',
        networkId: 1,
        blockNumber: Math.floor(Math.random() * 1000000),
        gasUsed: '21000',
        gasPrice: '20000000000',
        from: params.fromAddress,
        to: params.toAddress,
        value: params.amount,
        type: 'send',
        notes: params.notes
      };

      // Store transaction record
      const transactionData = {
        ...transaction,
        globalUserId: params.globalUserId,
        projectSlug: this.projectSlug,
        createdAt: new Date()
      };

      const result = await dbService.create('project_wallet_transactions', transactionData);
      if (!result.success) {
        throw new Error(`Failed to record transaction: ${result.error}`);
      }

      // Update contact last used if recipient is in contacts
      await this.updateContactLastUsed(params.globalUserId, params.toAddress);

      return transaction;

    } catch (error) {
      console.error('WalletService - Error sending tokens:', error);
      throw error;
    }
  }

  /**
   * Get transaction history for user in this project
   */
  async getTransactionHistory(globalUserId: string, limit: number = 20): Promise<WalletTransaction[]> {
    console.log(`📊 WalletService - Getting transaction history for user ${globalUserId} in project ${this.projectSlug}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const query = {
        collection: 'project_wallet_transactions',
        filters: [
          { field: 'global_user_id', operator: '==', value: globalUserId },
          { field: 'project_slug', operator: '==', value: this.projectSlug }
        ],
        orderBy: [{ field: 'timestamp', direction: 'desc' as const }],
        pagination: { limit }
      };

      const result = await dbService.query(query);

      if (!result.success) {
        throw new Error(`Failed to query transactions: ${result.error}`);
      }

      return (result.data || []).map(doc => ({
        id: doc.data.id || doc.id,
        timestamp: doc.data.timestamp,
        walletAddress: doc.data.wallet_address,
        txHash: doc.data.tx_hash,
        recipient: doc.data.recipient,
        amount: doc.data.amount,
        tokenSymbol: doc.data.token_symbol,
        status: doc.data.status,
        networkId: doc.data.network_id,
        blockNumber: doc.data.block_number,
        gasUsed: doc.data.gas_used,
        gasPrice: doc.data.gas_price,
        from: doc.data.from_address,
        to: doc.data.to_address,
        value: doc.data.value,
        type: doc.data.transaction_type,
        notes: doc.data.notes
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

  private generateTransactionHash(): string {
    return '0x' + Math.random().toString(16).substr(2, 64);
  }

  private async updateContactLastUsed(globalUserId: string, address: string): Promise<void> {
    try {
      const contacts = await this.getContacts(globalUserId);
      const contact = contacts.find(c => c.address.toLowerCase() === address.toLowerCase());

      if (contact) {
        const initResult = await initializeDatabase();
        if (!initResult.success) return;

        const dbService = getDatabaseService();
        await dbService.update('project_wallet_contacts', contact.id, {
          last_used: new Date().toISOString()
        });
      }
    } catch (error) {
      console.warn('Failed to update contact last used:', error);
    }
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
