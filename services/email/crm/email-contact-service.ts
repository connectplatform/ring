/**
 * Email Contact Service (CRM)
 * ===========================
 * Manages email contact registry for external inquirers
 * Reference: Email Automation Specialist skillset
 */

import { logger } from '@/lib/logger';

export interface EmailContact {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  type: ContactType;
  tags: string[];
  metadata: Record<string, unknown>;
  ringUserId: string | null;
  firstContact: Date;
  lastContact: Date;
  totalInteractions: number;
  sentimentHistory: SentimentEntry[];
}

export type ContactType = 'lead' | 'customer' | 'partner' | 'vendor' | 'spam' | 'unknown';

export interface SentimentEntry {
  sentiment: string;
  score: number;
  timestamp: Date;
}

export interface ContactCreateInput {
  email: string;
  name?: string;
  company?: string;
  type?: ContactType;
  tags?: string[];
  metadata?: Record<string, unknown>;
  ringUserId?: string;
}

export interface ContactUpdateInput {
  name?: string;
  company?: string;
  type?: ContactType;
  tags?: string[];
  metadata?: Record<string, unknown>;
  ringUserId?: string;
}

export interface ContactSearchParams {
  email?: string;
  name?: string;
  company?: string;
  type?: ContactType;
  tags?: string[];
  hasRingAccount?: boolean;
  limit?: number;
  offset?: number;
}

// Database interface (to be implemented with actual DB)
export interface ContactRepository {
  findById(id: string): Promise<EmailContact | null>;
  findByEmail(email: string): Promise<EmailContact | null>;
  create(input: ContactCreateInput): Promise<EmailContact>;
  update(id: string, input: ContactUpdateInput): Promise<EmailContact>;
  search(params: ContactSearchParams): Promise<EmailContact[]>;
  incrementInteractions(id: string): Promise<void>;
  addSentimentEntry(id: string, entry: SentimentEntry): Promise<void>;
  delete(id: string): Promise<void>;
}

export class EmailContactService {
  constructor(private repository: ContactRepository) {}
  
  /**
   * Get or create contact by email
   */
  async getOrCreateContact(
    email: string,
    initialData?: Partial<ContactCreateInput>
  ): Promise<EmailContact> {
    // Try to find existing contact
    const existing = await this.repository.findByEmail(email.toLowerCase());
    
    if (existing) {
      // Update last contact time and increment interactions
      await this.repository.incrementInteractions(existing.id);
      
      logger.debug('[EmailContactService] Found existing contact', {
        contactId: existing.id,
        email: existing.email,
        totalInteractions: existing.totalInteractions + 1,
      });
      
      return {
        ...existing,
        lastContact: new Date(),
        totalInteractions: existing.totalInteractions + 1,
      };
    }
    
    // Create new contact
    const newContact = await this.repository.create({
      email: email.toLowerCase(),
      name: initialData?.name,
      company: initialData?.company,
      type: initialData?.type || 'lead',
      tags: initialData?.tags || [],
      metadata: initialData?.metadata || {},
      ringUserId: initialData?.ringUserId,
    });
    
    logger.info('[EmailContactService] Created new contact', {
      contactId: newContact.id,
      email: newContact.email,
      type: newContact.type,
    });
    
    return newContact;
  }
  
  /**
   * Update contact information
   */
  async updateContact(id: string, input: ContactUpdateInput): Promise<EmailContact> {
    const updated = await this.repository.update(id, input);
    
    logger.info('[EmailContactService] Contact updated', {
      contactId: id,
      updates: Object.keys(input),
    });
    
    return updated;
  }
  
  /**
   * Add sentiment entry to contact history
   */
  async recordSentiment(
    contactId: string,
    sentiment: string,
    score: number
  ): Promise<void> {
    await this.repository.addSentimentEntry(contactId, {
      sentiment,
      score,
      timestamp: new Date(),
    });
    
    logger.debug('[EmailContactService] Sentiment recorded', {
      contactId,
      sentiment,
      score,
    });
  }
  
  /**
   * Calculate sentiment trend for contact
   */
  getSentimentTrend(
    contact: EmailContact
  ): 'improving' | 'stable' | 'declining' | 'unknown' {
    const history = contact.sentimentHistory;
    
    if (history.length < 3) {
      return 'unknown';
    }
    
    // Get recent vs older sentiment averages
    const sorted = [...history].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    const recentCount = Math.ceil(sorted.length / 2);
    const recent = sorted.slice(0, recentCount);
    const older = sorted.slice(recentCount);
    
    const avgRecent = recent.reduce((sum, h) => sum + h.score, 0) / recent.length;
    const avgOlder = older.reduce((sum, h) => sum + h.score, 0) / older.length;
    
    const diff = avgRecent - avgOlder;
    
    if (diff > 0.2) return 'improving';
    if (diff < -0.2) return 'declining';
    return 'stable';
  }
  
  /**
   * Link contact to Ring Platform user
   */
  async linkToRingUser(contactId: string, ringUserId: string): Promise<EmailContact> {
    const updated = await this.repository.update(contactId, {
      ringUserId,
      type: 'customer', // Upgrade to customer if they have an account
    });
    
    logger.info('[EmailContactService] Contact linked to Ring user', {
      contactId,
      ringUserId,
    });
    
    return updated;
  }
  
  /**
   * Search contacts
   */
  async searchContacts(params: ContactSearchParams): Promise<EmailContact[]> {
    return this.repository.search(params);
  }
  
  /**
   * Update contact type based on behavior
   */
  async classifyContact(contact: EmailContact): Promise<ContactType> {
    // Already classified
    if (contact.type !== 'unknown' && contact.type !== 'lead') {
      return contact.type;
    }
    
    // Has Ring account = customer (type is already narrowed to 'unknown' | 'lead' here)
    if (contact.ringUserId) {
      await this.repository.update(contact.id, { type: 'customer' });
      return 'customer';
    }
    
    // Check metadata for partnership indicators
    const metadata = contact.metadata;
    if (metadata.isPartner || metadata.partnerApplication) {
      await this.repository.update(contact.id, { type: 'partner' });
      return 'partner';
    }
    
    // Default to lead
    return 'lead';
  }
  
  /**
   * Mark contact as spam
   */
  async markAsSpam(contactId: string): Promise<void> {
    await this.repository.update(contactId, { type: 'spam' });
    
    logger.warn('[EmailContactService] Contact marked as spam', { contactId });
  }
  
  /**
   * Add tag to contact
   */
  async addTag(contactId: string, tag: string): Promise<EmailContact> {
    const contact = await this.repository.findById(contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }
    
    if (!contact.tags.includes(tag)) {
      const updated = await this.repository.update(contactId, {
        tags: [...contact.tags, tag],
      });
      return updated;
    }
    
    return contact;
  }
  
  /**
   * Remove tag from contact
   */
  async removeTag(contactId: string, tag: string): Promise<EmailContact> {
    const contact = await this.repository.findById(contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }
    
    const updated = await this.repository.update(contactId, {
      tags: contact.tags.filter(t => t !== tag),
    });
    
    return updated;
  }
  
  /**
   * Get contact statistics
   */
  async getStatistics(): Promise<{
    totalContacts: number;
    byType: Record<ContactType, number>;
    withRingAccount: number;
    recentlyActive: number;
  }> {
    // This would be a database aggregation query in production
    const allContacts = await this.repository.search({ limit: 10000 });
    
    const byType: Record<ContactType, number> = {
      lead: 0,
      customer: 0,
      partner: 0,
      vendor: 0,
      spam: 0,
      unknown: 0,
    };
    
    let withRingAccount = 0;
    let recentlyActive = 0;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    for (const contact of allContacts) {
      byType[contact.type]++;
      if (contact.ringUserId) withRingAccount++;
      if (new Date(contact.lastContact) > oneWeekAgo) recentlyActive++;
    }
    
    return {
      totalContacts: allContacts.length,
      byType,
      withRingAccount,
      recentlyActive,
    };
  }
}

// In-memory repository for development/testing
export class InMemoryContactRepository implements ContactRepository {
  private contacts: Map<string, EmailContact> = new Map();
  private counter = 0;
  
  async findById(id: string): Promise<EmailContact | null> {
    return this.contacts.get(id) || null;
  }
  
  async findByEmail(email: string): Promise<EmailContact | null> {
    for (const contact of this.contacts.values()) {
      if (contact.email.toLowerCase() === email.toLowerCase()) {
        return contact;
      }
    }
    return null;
  }
  
  async create(input: ContactCreateInput): Promise<EmailContact> {
    const id = `contact_${++this.counter}`;
    const contact: EmailContact = {
      id,
      email: input.email.toLowerCase(),
      name: input.name || null,
      company: input.company || null,
      type: input.type || 'lead',
      tags: input.tags || [],
      metadata: input.metadata || {},
      ringUserId: input.ringUserId || null,
      firstContact: new Date(),
      lastContact: new Date(),
      totalInteractions: 1,
      sentimentHistory: [],
    };
    this.contacts.set(id, contact);
    return contact;
  }
  
  async update(id: string, input: ContactUpdateInput): Promise<EmailContact> {
    const contact = this.contacts.get(id);
    if (!contact) throw new Error('Contact not found');
    
    const updated: EmailContact = {
      ...contact,
      ...input,
      lastContact: new Date(),
    };
    this.contacts.set(id, updated);
    return updated;
  }
  
  async search(params: ContactSearchParams): Promise<EmailContact[]> {
    let results = Array.from(this.contacts.values());
    
    if (params.email) {
      results = results.filter(c => c.email.includes(params.email!.toLowerCase()));
    }
    if (params.name) {
      results = results.filter(c => c.name?.toLowerCase().includes(params.name!.toLowerCase()));
    }
    if (params.company) {
      results = results.filter(c => c.company?.toLowerCase().includes(params.company!.toLowerCase()));
    }
    if (params.type) {
      results = results.filter(c => c.type === params.type);
    }
    if (params.tags && params.tags.length > 0) {
      results = results.filter(c => params.tags!.some(t => c.tags.includes(t)));
    }
    if (params.hasRingAccount !== undefined) {
      results = results.filter(c => 
        params.hasRingAccount ? c.ringUserId !== null : c.ringUserId === null
      );
    }
    
    const offset = params.offset || 0;
    const limit = params.limit || 100;
    
    return results.slice(offset, offset + limit);
  }
  
  async incrementInteractions(id: string): Promise<void> {
    const contact = this.contacts.get(id);
    if (contact) {
      contact.totalInteractions++;
      contact.lastContact = new Date();
    }
  }
  
  async addSentimentEntry(id: string, entry: SentimentEntry): Promise<void> {
    const contact = this.contacts.get(id);
    if (contact) {
      contact.sentimentHistory.push(entry);
      // Keep only last 20 entries
      if (contact.sentimentHistory.length > 20) {
        contact.sentimentHistory = contact.sentimentHistory.slice(-20);
      }
    }
  }
  
  async delete(id: string): Promise<void> {
    this.contacts.delete(id);
  }
}

// Singleton with in-memory repo for now
let serviceInstance: EmailContactService | null = null;

export function getEmailContactService(): EmailContactService {
  if (!serviceInstance) {
    serviceInstance = new EmailContactService(new InMemoryContactRepository());
  }
  return serviceInstance;
}

export default EmailContactService;
