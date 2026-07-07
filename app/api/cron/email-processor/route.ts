import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { getEmailProcessor } from '@/services/email/email-processor'
import { getEmailTaskService } from '@/services/email/crm/task-service'
import { ProcessConductor } from '@/lib/processes'
import { getPipelineDefinition } from '@/lib/processes/registry'

type CronAction = 'poll' | 'start' | 'stop' | 'status' | 'mark-overdue-tasks'

export async function POST(request: NextRequest) {
  // Ensure DB or other necessary connection is established for this request.
  await connection()

  // Authorization: Use a secret passed in the 'authorization' header to prevent unauthorized access
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Construct the URL to easily access query parameters
  const url = new URL(request.url)
  // Parse body if method is not GET, fallback to empty object on parse error
  const body =
    request.method === 'GET' ? {} : await request.json().catch(() => ({}))
  // Action can come from JSON body or query params, or defaults to 'poll'
  const action = ((body as { action?: string }).action ?? url.searchParams.get('action') ?? 'poll') as CronAction
  // Instantiate processor for actions
  const processor = getEmailProcessor()

  try {
    switch (action) {
      case 'poll': {
        // Get the handler registered for the 'email-processor' pipeline
        const handler = getPipelineDefinition('email-processor')?.handler
        if (!handler) {
          // Pipeline has not been registered, cannot proceed
          return NextResponse.json({ error: 'Pipeline not registered' }, { status: 500 })
        }
        // Run process and record its run metadata
        const { result, run } = await ProcessConductor.recordRun('email-processor', 'cron', handler)
        if (run.status === 'error') {
          // If the process run returns an error, handle here
          return NextResponse.json(
            { success: false, action, error: run.error, runId: run.id },
            { status: 500 },
          )
        }
        // Return process run result and metadata
        return NextResponse.json({ success: true, action, ...(result as object), runId: run.id })
      }
      case 'start': {
        // Check if the processor is allowed to start via HTTP (security check)
        if (process.env.EMAIL_PROCESSOR_ALLOW_HTTP_START !== 'true') {
          return NextResponse.json({ error: 'HTTP start disabled' }, { status: 403 })
        }
        // Start the background email processor
        await processor.start()
        // Return stats after starting
        return NextResponse.json({ success: true, action, stats: processor.getStats() })
      }
      case 'stop':
        // Stop the background email processor
        await processor.stop()
        // Return stats after stopping
        return NextResponse.json({ success: true, action, stats: processor.getStats() })
      case 'status':
        // Just return current stats of the processor
        return NextResponse.json({ success: true, action, stats: processor.getStats() })
      case 'mark-overdue-tasks': {
        // Invoke the logic that marks overdue email tasks
        const count = await getEmailTaskService().processOverdueTasks()
        return NextResponse.json({ success: true, action, overdueMarked: count })
      }
      default:
        // If the action is unrecognized, return error
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    // Generic error handler; returns error message from caught exception, if possible
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// For GET requests, reuse the POST handler to keep logic centralized 
// TODO: Consider using Next 16 Route Handlers' ability to define a single handler for all HTTP methods if possible.
export async function GET(request: NextRequest) {
  return POST(request)
}
