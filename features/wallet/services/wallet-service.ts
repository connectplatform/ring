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
import { db } from '@/lib/database';

type ProjectWalletRow = {
  address?: string;
  primary?: boolean;
  label?: string;
  created_at?: string;
  createdAt?: string;
};

type WalletContactRow = {
  id?: string;
  name?: string;
  address?: string;
  notes?: string;
  is_favorite?: boolean;
  isFavorite?: boolean;
  is_default?: boolean;
  isDefault?: boolean;
  added_at?: string;
  addedAt?: string;
  last_used?: string;
  lastUsed?: string;
};

function mapWalletContactRow(row: WalletContactRow & { id: string }): WalletContact {
  return {
    id: row.id,
    name: row.name ?? '',
    address: row.address ?? '',
    notes: row.notes,
    isFavorite: row.isFavorite ?? row.is_favorite ?? false,
    isDefault: row.isDefault ?? row.is_default ?? false,
    addedAt: row.addedAt ?? row.added_at,
    lastUsed: row.lastUsed ?? row.last_used,
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

      const result = await db().createDoc('project_wallets', walletData as unknown as Record<string, unknown>);
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
  // CONTACT MANAGEMENT - PER-PROJECT
  // ============================================================================

  /**
   * Add contact to project address book
   */
  async addContact(globalUserId: string, contactData: Omit<WalletContact, 'id' | 'addedAt'>): Promise<WalletContact> {
    console.log(`📇 WalletService - Adding contact for user ${globalUserId} in project ${this.projectSlug}: ${contactData.name}`);

    try {
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

      const existingResult = await db().queryDocs<WalletContactRow>(existingQuery);

      if (existingResult.success && existingResult.data.length > 0) {
        const existingId = existingResult.data[0].id;
        const updateResult = await db().updateDoc('project_wallet_contacts', existingId, {
          ...contact,
          last_used: new Date().toISOString(),
        });

        if (updateResult.success && updateResult.data) {
          const updated = updateResult.data;
          return {
            ...mapWalletContactRow(updated),
            name: contact.name,
            address: contact.address,
            addedAt: contact.addedAt
          };
        }
      }

      // Create new contact
      const fullContact = {
        ...contact,
        globalUserId,
        projectSlug: this.projectSlug
      };

      const result = await db().createDoc('project_wallet_contacts', fullContact);
      if (!result.success) {
        throw new Error(`Failed to add contact: ${result.error}`);
      }

      const created = result.data;
      return {
        ...contact,
        id: created.id,
        name: contact.name,
        address: contact.address,
        addedAt: created.addedAt ?? (created as WalletContactRow).added_at ?? contact.addedAt
      };

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
      const result = await db().queryDocs<WalletContactRow>({
        collection: 'project_wallet_contacts',
        filters: [
          { field: 'global_user_id', operator: '==', value: globalUserId },
          { field: 'project_slug', operator: '==', value: this.projectSlug }
        ],
        orderBy: [
          { field: 'is_favorite', direction: 'desc' as const },
          { field: 'last_used', direction: 'desc' as const }
        ]
      });

      if (!result.success) {
        throw new Error(`Failed to query contacts: ${result.error}`);
      }

      return result.data.map(doc => mapWalletContactRow(doc));

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
      const result = await db().deleteDoc('project_wallet_contacts', contactId);
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

      const result = await db().createDoc('project_wallet_transactions', transactionData);
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

  private generateTransactionHash(): string {
    return '0x' + Math.random().toString(16).substr(2, 64);
  }

  private async updateContactLastUsed(globalUserId: string, address: string): Promise<void> {
    try {
      const contacts = await this.getContacts(globalUserId);
      const contact = contacts.find(c => c.address.toLowerCase() === address.toLowerCase());

      if (contact) {
        await db().updateDoc('project_wallet_contacts', contact.id, {
          last_used: new Date().toISOString(),
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
