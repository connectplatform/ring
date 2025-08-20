import { NextRequest, NextResponse } from 'next/server'
import { AITrainingPipeline } from '@/lib/ai/training-pipeline'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest) {
  try {
    const pipeline = new AITrainingPipeline()
    const data = await pipeline.collectTrainingData()
    const patterns = await pipeline.extractPatterns(data)
    await pipeline.updateModels(patterns)
    await pipeline.deployUpdates()
    return NextResponse.json({ ok: true, examples: data.length, patterns: patterns.patterns.length })
  } catch (e) {
    console.error('cron/train error', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}


