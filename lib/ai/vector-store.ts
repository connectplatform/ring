export interface VectorMeta { [key: string]: unknown }

let inMemoryStore: { [ns: string]: Array<{ id: string; vec: number[]; meta?: VectorMeta }> } = {}

export function isVectorStoreEnabled(): boolean {
  return process.env.RING_VECTOR_STORE === 'memory' || !!process.env.PGVECTOR_URL || !!process.env.PINECONE_API_KEY
}

export async function upsertVector(namespace: string, id: string, vec: number[], meta?: VectorMeta): Promise<void> {
  const ns = inMemoryStore[namespace] || (inMemoryStore[namespace] = [])
  const idx = ns.findIndex(x => x.id === id)
  if (idx >= 0) ns[idx] = { id, vec, meta }
  else ns.push({ id, vec, meta })
}

export async function querySimilar(namespace: string, vec: number[], topK: number = 10): Promise<Array<{ id: string; score: number }>> {
  const ns = inMemoryStore[namespace] || []
  // Cosine similarity (naive implementation)
  const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * (b[i] || 0), 0)
  const mag = (a: number[]) => Math.sqrt(a.reduce((s, v) => s + v * v, 0))
  const denom = mag(vec) || 1
  const scored = ns.map(x => ({ id: x.id, score: (dot(vec, x.vec) / ((mag(x.vec) || 1) * denom)) || 0 }))
  return scored.sort((a,b)=>b.score-a.score).slice(0, topK)
}


