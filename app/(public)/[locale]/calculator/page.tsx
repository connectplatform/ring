import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { buildMessages } from '@/lib/i18n'
import { getRingConfig } from '@/lib/ring-config'
import { CalculatorEngine } from '@/features/calculator/calculator-engine'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const messages = await buildMessages(locale, 'public')
  const t = messages.calculator || {}

  return {
    title: t.title || 'Ring Platform Calculator',
    description:
      t.description ||
      'Calculate your deployment time, costs, and get a customized roadmap for launching your Ring platform',
    keywords: ['Ring Platform', 'calculator', 'platform setup', 'cost estimation'],
  }
}

export default function CalculatorPage() {
  const config = getRingConfig()
  if (!config.calculator?.enabled) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <CalculatorEngine />
    </div>
  )
}
