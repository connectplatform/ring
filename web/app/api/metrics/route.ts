import { NextResponse, connection } from 'next/server'
import { emailCrmMetrics } from '@/features/email-crm/pipeline/metrics'

/**
 * Prometheus scrape endpoint for Email CRM (+ future platform metrics).
 * Wire Grafana/Prometheus on k3s-or to scrape this path.
 * Note: do not set `export const dynamic` / `runtime` — incompatible with nextConfig.cacheComponents.
 */
export async function GET() {
  await connection()
  const body = emailCrmMetrics.render()
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
