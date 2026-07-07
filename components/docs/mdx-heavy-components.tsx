'use client'

import dynamic from 'next/dynamic'

const vizPlaceholder = () => (
  <div className="my-8 h-32 w-full animate-pulse rounded-lg bg-muted" aria-hidden />
)

export const MindMap = dynamic(
  () => import('@/components/docs/mindmap').then((mod) => ({ default: mod.MindMap })),
  { ssr: false, loading: vizPlaceholder },
)

export const RingGatewayBridge = dynamic(
  () =>
    import('@/components/docs/ring-gateway-bridge').then((mod) => ({
      default: mod.RingGatewayBridge,
    })),
  { ssr: false, loading: vizPlaceholder },
)

export const RingPaymentConductorFlow = dynamic(
  () =>
    import('@/components/docs/ring-payment-conductor-flow').then((mod) => ({
      default: mod.RingPaymentConductorFlow,
    })),
  { ssr: false, loading: vizPlaceholder },
)

export const RingWidgetFlowStepsFive = dynamic(
  () =>
    import('@/components/docs/ring-widget-flow-steps-five').then((mod) => ({
      default: mod.RingWidgetFlowStepsFive,
    })),
  { ssr: false, loading: vizPlaceholder },
)

export const RingCollectiveIntelligenceLoop = dynamic(
  () =>
    import('@/components/docs/ring-welcome-visuals').then((mod) => ({
      default: mod.RingCollectiveIntelligenceLoop,
    })),
  { ssr: false, loading: vizPlaceholder },
)

export const RingDeploymentPaths = dynamic(
  () =>
    import('@/components/docs/ring-deployment-paths').then((mod) => ({
      default: mod.RingDeploymentPaths,
    })),
  { ssr: false, loading: vizPlaceholder },
)

export const RingFeatureEcosystem = dynamic(
  () =>
    import('@/components/docs/ring-welcome-visuals').then((mod) => ({
      default: mod.RingFeatureEcosystem,
    })),
  { ssr: false, loading: vizPlaceholder },
)

export const RingProblemSolvingEvolution = dynamic(
  () =>
    import('@/components/docs/ring-welcome-visuals').then((mod) => ({
      default: mod.RingProblemSolvingEvolution,
    })),
  { ssr: false, loading: vizPlaceholder },
)

export const RingHumanityVision = dynamic(
  () =>
    import('@/components/docs/ring-welcome-visuals').then((mod) => ({
      default: mod.RingHumanityVision,
    })),
  { ssr: false, loading: vizPlaceholder },
)

export const RingAISynapseFlow = dynamic(
  () =>
    import('@/components/docs/ring-ai-synapse-flow').then((mod) => ({
      default: mod.RingAISynapseFlow,
    })),
  { ssr: false, loading: vizPlaceholder },
)

export const RingMatcherOrchestration = dynamic(
  () =>
    import('@/components/docs/ring-matcher-orchestration').then((mod) => ({
      default: mod.RingMatcherOrchestration,
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

export const RingWidgetsContact = dynamic(
  () =>
    import('@/components/ring-widgets/contact').then((mod) => ({
      default: mod.RingWidgetsContact,
    })),
  { ssr: false, loading: vizPlaceholder },
)

export const RingIntegrationPlanesHub = dynamic(
  () =>
    import('@/components/ring-widgets/ring-integration-planes-hub').then((mod) => ({
      default: mod.RingIntegrationPlanesHub,
    })),
  { ssr: false, loading: vizPlaceholder },
)

export const RingWelcomeFeatureExplorer = dynamic(
  () =>
    import('@/components/ring-widgets/ring-welcome-feature-explorer').then((mod) => ({
      default: mod.RingWelcomeFeatureExplorer,
    })),
  { ssr: false, loading: vizPlaceholder },
)

export const FutureFeatureWidget = dynamic(
  () =>
    import('@/components/docs/future-feature-widget').then((mod) => ({
      default: mod.FutureFeatureWidget,
    })),
  { ssr: false, loading: vizPlaceholder },
)

export const FutureFeatureBacklog = dynamic(
  () =>
    import('@/components/docs/future-feature-widget').then((mod) => ({
      default: mod.FutureFeatureBacklog,
    })),
  { ssr: false, loading: vizPlaceholder },
)
