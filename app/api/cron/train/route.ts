import { NextRequest, NextResponse } from 'next/server'
import { AITrainingPipeline } from '@/lib/ai/training-pipeline'


export async function POST(req: NextRequest) {
  // Fail closed: same contract as /api/cron/refcodes-mint
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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


