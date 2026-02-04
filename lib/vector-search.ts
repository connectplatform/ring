/**
 * Vector Search Utilities for Ring Platform
 * Provides semantic similarity matching for products and content
 */

export function getVectorSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i]
    normA += vectorA[i] * vectorA[i]
    normB += vectorB[i] * vectorB[i]
  }

  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dotProduct / (normA * normB)
}

/**
 * Generate mock embedding for product similarity
 * In production, this would use a real ML model
 */
export function generateProductEmbedding(product: {
  name: string
  description?: string
  category?: string
  tags?: string[]
}): number[] {
  // Simple hash-based embedding for demo purposes
  const text = `${product.name} ${product.description || ''} ${product.category || ''} ${product.tags?.join(' ') || ''}`.toLowerCase()

  // Create a 128-dimensional embedding using simple hashing
  const embedding: number[] = []
  for (let i = 0; i < 128; i++) {
    let hash = 0
    for (let j = 0; j < text.length; j++) {
      const char = text.charCodeAt(j)
      hash = ((hash << 5) - hash + char + i) & 0xffffffff
    }
    // Normalize to [-1, 1] range
    embedding.push((hash % 2000 - 1000) / 1000)
  }

  return embedding
}
