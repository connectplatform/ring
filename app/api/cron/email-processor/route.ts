import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { getEmailProcessor } from '@/services/email/email-processor'
import { validateEmailConfig } from '@/services/email/imap/config'
import { getEmailTaskService } from '@/services/email/crm/task-service'

type CronAction = 'poll' | 'start' | 'stop' | 'status' | 'mark-overdue-tasks'

export async function POST(request: NextRequest) {
  await connection()

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const body =
    request.method === 'GET' ? {} : await request.json().catch(() => ({}))
  const action = ((body as { action?: string }).action ?? url.searchParams.get('action') ?? 'poll') as CronAction
  const processor = getEmailProcessor()

  try {
    switch (action) {
      case 'poll': {
        const configCheck = validateEmailConfig()
        if (!configCheck.valid) {
          return NextResponse.json({ error: 'Invalid email config', details: configCheck.errors }, { status: 500 })
        }
        const result = await processor.pollInboundBatch()
        return NextResponse.json({ success: true, action, ...result, stats: processor.getStats() })
      }
      case 'start': {
        if (process.env.EMAIL_PROCESSOR_ALLOW_HTTP_START !== 'true') {
          return NextResponse.json({ error: 'HTTP start disabled' }, { status: 403 })
        }
        await processor.start()
        return NextResponse.json({ success: true, action, stats: processor.getStats() })
      }
      case 'stop':
        await processor.stop()
        return NextResponse.json({ success: true, action, stats: processor.getStats() })
      case 'status':
        return NextResponse.json({ success: true, action, stats: processor.getStats() })
      case 'mark-overdue-tasks': {
        const count = await getEmailTaskService().processOverdueTasks()
        return NextResponse.json({ success: true, action, overdueMarked: count })
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
