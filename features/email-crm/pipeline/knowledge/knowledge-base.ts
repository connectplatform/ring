/**
 * RAG Knowledge Base Service
 * ==========================
 * Vector-based knowledge retrieval for AI response generation
 * Uses PGVector for embeddings storage
 * Reference: Email Automation Specialist skillset
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  contentType: 'faq' | 'documentation' | 'response_template' | 'product_info';
  category: string;
  tags: string[];
  embedding?: number[];
  usageCount: number;
  lastUsedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult {
  document: KnowledgeDocument;
  score: number;
  snippet: string;
}

export interface KnowledgeCreateInput {
  title: string;
  content: string;
  contentType: 'faq' | 'documentation' | 'response_template' | 'product_info';
  category: string;
  tags?: string[];
}

// Embedding model configuration
const EMBEDDING_MODEL = 'voyage-3'; // Or use Anthropic's embedding via proxy
const EMBEDDING_DIMENSION = 1024;

// Pre-defined Ring Platform knowledge base content
const DEFAULT_KNOWLEDGE: Omit<KnowledgeDocument, 'id' | 'embedding' | 'usageCount' | 'lastUsedAt' | 'createdAt' | 'updatedAt'>[] = [
  {
    title: 'Getting Started with Ring Platform',
    content: `Ring Platform is an open-source React 19 / Next.js 15 / Web3 platform for building modern web applications.

Key Features:
- Built with React 19, Next.js 15, and Tailwind CSS 4
- Auth.js 5 for authentication (supports OAuth, credentials, magic links)
- Flexible backend: Firebase or ConnectPlatform
- Web3 integration for blockchain features
- Real-time collaboration support

Quick Start:
1. Clone the repository: git clone https://github.com/ring-platform/ring-platform
2. Install dependencies: npm install
3. Copy .env.example to .env.local and configure
4. Run development server: npm run dev

Documentation: https://docs.ringdom.org
GitHub: https://github.com/ring-platform`,
    contentType: 'documentation',
    category: 'onboarding',
    tags: ['getting-started', 'installation', 'quick-start'],
    isActive: true,
  },
  {
    title: 'Authentication Setup (Auth.js 5)',
    content: `Ring Platform uses Auth.js 5 (NextAuth.js v5) for authentication.

Configuration:
1. Set environment variables in .env.local:
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-secret-key

2. OAuth Providers:
   - Google: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
   - GitHub: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
   - Add more in auth.config.ts

3. Callback URLs for OAuth providers:
   http://localhost:3000/api/auth/callback/google
   http://localhost:3000/api/auth/callback/github

Troubleshooting:
- "Invalid callback URL": Check NEXTAUTH_URL matches your domain
- "OAuth error": Verify client ID/secret in provider dashboard
- Session issues: Clear cookies and check NEXTAUTH_SECRET

Documentation: https://docs.ringdom.org/auth`,
    contentType: 'documentation',
    category: 'technical',
    tags: ['authentication', 'auth.js', 'oauth', 'security'],
    isActive: true,
  },
  {
    title: 'Pricing Information',
    content: `Ring Platform Pricing:

Open Source (Free):
- Full access to Ring Platform codebase
- MIT License
- Community support via GitHub
- Documentation access

Enterprise Support (Custom Pricing):
- Dedicated support with SLA
- Custom deployment assistance
- Training and onboarding
- Priority feature development
- On-premise deployment options

ConnectPlatform Backend (Separate Product):
- Real-time Erlang/OTP backend
- 75-500x faster than HTTP
- Millions of concurrent connections
- Contact for enterprise pricing

For enterprise inquiries, email: enterprise@ringdom.org
For general questions: info@ringdom.org`,
    contentType: 'product_info',
    category: 'pricing',
    tags: ['pricing', 'enterprise', 'plans'],
    isActive: true,
  },
  {
    title: 'FAQ: Common Questions',
    content: `Frequently Asked Questions:

Q: Is Ring Platform free to use?
A: Yes! Ring Platform is open-source under the MIT license. You can use it for any project, commercial or personal.

Q: What backend should I use - Firebase or ConnectPlatform?
A: Firebase is great for getting started quickly and smaller projects. ConnectPlatform is our enterprise solution for high-performance real-time applications.

Q: How do I contribute to Ring Platform?
A: Fork the repo, make your changes, and submit a pull request. See CONTRIBUTING.md for guidelines.

Q: Can I use Ring Platform for commercial projects?
A: Absolutely! The MIT license allows commercial use.

Q: How do I get support?
A: Community support via GitHub issues. Enterprise customers get dedicated support.

Q: What's the tech stack?
A: React 19, Next.js 15, Tailwind CSS 4, Auth.js 5, and optionally Web3 for blockchain features.`,
    contentType: 'faq',
    category: 'general',
    tags: ['faq', 'questions', 'support'],
    isActive: true,
  },
  {
    title: 'Technical Support: Common Issues',
    content: `Common Technical Issues and Solutions:

1. Build Errors:
   - "Module not found": Run npm install, check import paths
   - TypeScript errors: Check tsconfig.json, run tsc --noEmit
   - CSS issues: Ensure Tailwind is configured correctly

2. Authentication Issues:
   - Callback URL errors: Verify NEXTAUTH_URL in .env
   - Session not persisting: Check NEXTAUTH_SECRET is set
   - OAuth failing: Verify provider credentials

3. Database Issues:
   - Connection refused: Check database URL format
   - Migration errors: Run npx prisma migrate reset
   - Query errors: Check schema matches database

4. Deployment Issues:
   - Vercel: Ensure environment variables are set
   - Docker: Check Dockerfile and compose configuration
   - Self-hosted: Verify Node.js version (18+)

For detailed troubleshooting: https://docs.ringdom.org/troubleshooting`,
    contentType: 'documentation',
    category: 'technical',
    tags: ['troubleshooting', 'errors', 'support', 'debugging'],
    isActive: true,
  },
  {
    title: 'Response Template: Feature Request',
    content: `Thank you for your feature suggestion!

We really appreciate you taking the time to share your ideas with us. Feature requests like yours help us understand what our users need most.

{feature_acknowledgment}

We've added your request to our feature tracking system. While we can't guarantee implementation timelines, we carefully consider all community feedback when planning our roadmap.

You can follow our progress on the public roadmap: https://ringdom.org/roadmap

In the meantime, {workaround_or_alternative}

Thanks for being part of the Ring Platform community!

Best,
Ring Platform Team`,
    contentType: 'response_template',
    category: 'product',
    tags: ['template', 'feature-request', 'response'],
    isActive: true,
  },
  {
    title: 'Response Template: Technical Support',
    content: `Hi {customer_name},

Thanks for reaching out about {issue_summary}.

{troubleshooting_steps}

Here are some additional resources that might help:
- Documentation: {relevant_doc_link}
- GitHub Discussions: https://github.com/ring-platform/discussions

If you're still running into issues after trying these steps, please share:
- Your Ring Platform version
- Relevant error messages (screenshots or logs)
- Steps to reproduce the issue

We're happy to help you get this working!

Best,
Ring Platform Support`,
    contentType: 'response_template',
    category: 'support',
    tags: ['template', 'technical-support', 'response'],
    isActive: true,
  },
];

// Database interface
export interface KnowledgeRepository {
  findById(id: string): Promise<KnowledgeDocument | null>;
  search(query: string, limit?: number): Promise<KnowledgeDocument[]>;
  semanticSearch(embedding: number[], limit?: number): Promise<SearchResult[]>;
  create(input: KnowledgeCreateInput, embedding?: number[]): Promise<KnowledgeDocument>;
  update(id: string, input: Partial<KnowledgeCreateInput>): Promise<KnowledgeDocument>;
  delete(id: string): Promise<void>;
  incrementUsage(id: string): Promise<void>;
  findByCategory(category: string): Promise<KnowledgeDocument[]>;
  findByTags(tags: string[]): Promise<KnowledgeDocument[]>;
}

export class KnowledgeBaseService {
  private anthropic: Anthropic;
  private cache: Map<string, { embedding: number[]; timestamp: number }> = new Map();
  private cacheTtl = 1000 * 60 * 60; // 1 hour
  
  constructor(private repository: KnowledgeRepository) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  
  /**
   * Search knowledge base for relevant content
   */
  async search(
    query: string,
    options: {
      limit?: number;
      category?: string;
      contentType?: string;
      minScore?: number;
    } = {}
  ): Promise<SearchResult[]> {
    const limit = options.limit || 5;
    const minScore = options.minScore || 0.5;
    
    try {
      // Generate embedding for query
      const embedding = await this.generateEmbedding(query);
      
      // Semantic search
      let results = await this.repository.semanticSearch(embedding, limit * 2);
      
      // Filter by category if specified
      if (options.category) {
        results = results.filter(r => r.document.category === options.category);
      }
      
      // Filter by content type if specified
      if (options.contentType) {
        results = results.filter(r => r.document.contentType === options.contentType);
      }
      
      // Filter by minimum score
      results = results.filter(r => r.score >= minScore);
      
      // Limit results
      results = results.slice(0, limit);
      
      // Increment usage counts
      for (const result of results) {
        await this.repository.incrementUsage(result.document.id);
      }
      
      logger.info('[KnowledgeBaseService] Search completed', {
        query: query.slice(0, 50),
        resultCount: results.length,
        topScore: results[0]?.score,
      });
      
      return results;
    } catch (error) {
      logger.error('[KnowledgeBaseService] Search failed', {
        error: (error as Error).message,
      });
      
      // Fallback to keyword search
      return this.keywordSearch(query, limit);
    }
  }
  
  /**
   * Keyword-based fallback search
   */
  private async keywordSearch(query: string, limit: number): Promise<SearchResult[]> {
    const results = await this.repository.search(query, limit);
    
    return results.map(doc => ({
      document: doc,
      score: 0.6, // Default score for keyword matches
      snippet: doc.content.slice(0, 200) + '...',
    }));
  }
  
  /**
   * Generate embedding for text using Claude
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // Check cache first
    const cacheKey = text.slice(0, 100);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
      return cached.embedding;
    }
    
    // For now, use a simple hash-based pseudo-embedding
    // In production, use Voyage AI, OpenAI, or Anthropic embeddings
    const embedding = this.pseudoEmbedding(text);
    
    // Cache result
    this.cache.set(cacheKey, { embedding, timestamp: Date.now() });
    
    return embedding;
  }
  
  /**
   * Simple pseudo-embedding for development
   * Replace with actual embedding API in production
   */
  private pseudoEmbedding(text: string): number[] {
    const embedding = new Array(EMBEDDING_DIMENSION).fill(0);
    const words = text.toLowerCase().split(/\s+/);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length; j++) {
        const idx = (word.charCodeAt(j) * (i + 1) * (j + 1)) % EMBEDDING_DIMENSION;
        embedding[idx] += 1;
      }
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }
    
    return embedding;
  }
  
  /**
   * Add document to knowledge base
   */
  async addDocument(input: KnowledgeCreateInput): Promise<KnowledgeDocument> {
    const embedding = await this.generateEmbedding(input.content);
    return this.repository.create(input, embedding);
  }
  
  /**
   * Get response templates for an intent
   */
  async getTemplates(intent: string): Promise<KnowledgeDocument[]> {
    const templates = await this.repository.findByCategory('response_template');
    return templates.filter(t => t.isActive);
  }
  
  /**
   * Get FAQ content
   */
  async getFAQs(category?: string): Promise<KnowledgeDocument[]> {
    if (category) {
      const docs = await this.repository.findByCategory(category);
      return docs.filter(d => d.contentType === 'faq' && d.isActive);
    }
    
    const allDocs = await this.repository.search('', 100);
    return allDocs.filter(d => d.contentType === 'faq' && d.isActive);
  }
  
  /**
   * Format search results for AI context
   */
  formatForContext(results: SearchResult[]): string {
    if (results.length === 0) {
      return '';
    }
    
    let formatted = 'RELEVANT KNOWLEDGE:\n';
    formatted += '─'.repeat(40) + '\n';
    
    for (const result of results) {
      formatted += `[${result.document.contentType.toUpperCase()}] ${result.document.title}\n`;
      formatted += result.document.content.slice(0, 500);
      if (result.document.content.length > 500) formatted += '...';
      formatted += '\n\n';
    }
    
    return formatted;
  }
  
  /**
   * Initialize default knowledge base
   */
  async initializeDefaultKnowledge(): Promise<void> {
    for (const doc of DEFAULT_KNOWLEDGE) {
      try {
        await this.addDocument(doc);
        logger.info('[KnowledgeBaseService] Added default document', { title: doc.title });
      } catch (error) {
        logger.warn('[KnowledgeBaseService] Failed to add document', {
          title: doc.title,
          error: (error as Error).message,
        });
      }
    }
  }
}

// In-memory repository
export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  private documents: Map<string, KnowledgeDocument> = new Map();
  private counter = 0;
  
  async findById(id: string): Promise<KnowledgeDocument | null> {
    return this.documents.get(id) || null;
  }
  
  async search(query: string, limit = 10): Promise<KnowledgeDocument[]> {
    const queryLower = query.toLowerCase();
    const results: KnowledgeDocument[] = [];
    
    for (const doc of this.documents.values()) {
      if (!doc.isActive) continue;
      
      const titleMatch = doc.title.toLowerCase().includes(queryLower);
      const contentMatch = doc.content.toLowerCase().includes(queryLower);
      const tagMatch = doc.tags.some(t => t.toLowerCase().includes(queryLower));
      
      if (titleMatch || contentMatch || tagMatch || !query) {
        results.push(doc);
      }
    }
    
    return results.slice(0, limit);
  }
  
  async semanticSearch(embedding: number[], limit = 5): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    for (const doc of this.documents.values()) {
      if (!doc.isActive || !doc.embedding) continue;
      
      const score = this.cosineSimilarity(embedding, doc.embedding);
      results.push({
        document: doc,
        score,
        snippet: doc.content.slice(0, 200) + '...',
      });
    }
    
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }
  
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }
  
  async create(input: KnowledgeCreateInput, embedding?: number[]): Promise<KnowledgeDocument> {
    const id = `kb_${++this.counter}`;
    const now = new Date();
    
    const doc: KnowledgeDocument = {
      id,
      ...input,
      tags: input.tags || [],
      embedding,
      usageCount: 0,
      lastUsedAt: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    
    this.documents.set(id, doc);
    return doc;
  }
  
  async update(id: string, input: Partial<KnowledgeCreateInput>): Promise<KnowledgeDocument> {
    const doc = this.documents.get(id);
    if (!doc) throw new Error('Document not found');
    
    const updated = {
      ...doc,
      ...input,
      updatedAt: new Date(),
    };
    
    this.documents.set(id, updated);
    return updated;
  }
  
  async delete(id: string): Promise<void> {
    this.documents.delete(id);
  }
  
  async incrementUsage(id: string): Promise<void> {
    const doc = this.documents.get(id);
    if (doc) {
      doc.usageCount++;
      doc.lastUsedAt = new Date();
    }
  }
  
  async findByCategory(category: string): Promise<KnowledgeDocument[]> {
    return Array.from(this.documents.values()).filter(
      d => d.category === category && d.isActive
    );
  }
  
  async findByTags(tags: string[]): Promise<KnowledgeDocument[]> {
    return Array.from(this.documents.values()).filter(
      d => d.isActive && tags.some(t => d.tags.includes(t))
    );
  }
}

// Singleton
let serviceInstance: KnowledgeBaseService | null = null;

export function getKnowledgeBaseService(): KnowledgeBaseService {
  if (!serviceInstance) {
    serviceInstance = new KnowledgeBaseService(new InMemoryKnowledgeRepository());
  }
  return serviceInstance;
}

export default KnowledgeBaseService;
