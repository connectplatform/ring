'use client'

import dynamic from 'next/dynamic'

const vizPlaceholder = () => (
  <div className="my-8 h-32 w-full animate-pulse rounded-lg bg-muted" aria-hidden />
)

export const MindMap = dynamic(
  () => import('@/components/docs/mindmap').then((mod) => ({ default: mod.MindMap })),
  { ssr: false, loading: vizPlaceholder },
)

export const RingAISynapseFlow = dynamic(
  () =>
    import('@/components/docs/ring-ai-synapse-flow').then((mod) => ({
      default: mod.RingAISynapseFlow,
    })),
  { ssr: false, loading: vizPlaceholder },
)

export const Timeline = dynamic(
  () => import('@/components/docs/timeline').then((mod) => ({ default: mod.Timeline })),
  { ssr: false, loading: vizPlaceholder },
)

export const Math = dynamic(
  () => import('@/components/docs/math').then((mod) => ({ default: mod.Math })),
  { ssr: false, loading: vizPlaceholder },
)

export const MathBlock = dynamic(
  () => import('@/components/docs/math').then((mod) => ({ default: mod.MathBlock })),
  { ssr: false, loading: vizPlaceholder },
)

export const CodeSandbox = dynamic(
  () => import('@/components/docs/code-sandbox').then((mod) => ({ default: mod.CodeSandbox })),
  { ssr: false, loading: vizPlaceholder },
)
