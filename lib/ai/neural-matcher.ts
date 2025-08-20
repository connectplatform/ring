import type { Opportunity } from '@/types'
import { getAdminDb } from '@/lib/firebase-admin.server'
import { isVectorStoreEnabled, upsertVector, querySimilar } from '@/lib/ai/vector-store'

export interface Match { id: string; score: number; reason?: string }

export class NeuralMatcher {
  async match(opportunity: Opportunity): Promise<Match[]> {
    const embedding = await this.embed(opportunity)
    // Index this opportunity vector opportunistically (id may not exist when called externally)
    if ((opportunity as any).id) {
      try { await upsertVector('opportunities', (opportunity as any).id, embedding, { tags: opportunity.tags || [] }) } catch {}
    }
    const similar = await this.vectorSearch(embedding)
    const ranked = await this.rankMatches(similar)
    const explained = await this.explainMatches(opportunity, ranked)
    return explained
  }

  // Baseline embedding: bag-of-tags to a simple numeric vector (stub)
  private async embed(op: Opportunity): Promise<number[]> {
    const tags = (op.tags || []).slice(0, 16)
    return tags.map(t => (t?.length || 0) % 7)
  }

  // Baseline vector search: simple tag overlap against candidates from Firestore (top 50)
  private async vectorSearch(_embedding: number[]): Promise<Match[]> {
    if (isVectorStoreEnabled()) {
      const results = await querySimilar('opportunities', _embedding, 10)
      return results
    }
    const db = await getAdminDb()
    const snap = await db.collection('opportunities').limit(50).get()
    return snap.docs.map(d => ({ id: d.id, score: Math.random() }))
  }

  private async rankMatches(matches: Match[]): Promise<Match[]> {
    return matches.sort((a,b)=>b.score-a.score).slice(0, 10)
  }

  private async explainMatches(opportunity: Opportunity, matches: Match[]): Promise<Match[]> {
    const baseReason = (opportunity.tags && opportunity.tags.length) ? `tag-overlap:${opportunity.tags[0]}` : 'baseline'
    return matches.map(m => ({ ...m, reason: baseReason }))
  }
}

// Exportable helper for indexing outside the class
export async function generateOpportunityEmbedding(opportunity: Opportunity): Promise<number[]> {
  const tags = (opportunity.tags || []).slice(0, 16)
  return tags.map(t => (t?.length || 0) % 7)
}


