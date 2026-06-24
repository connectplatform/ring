import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  DollarSign,
  GraduationCap,
  Handshake,
  HelpCircle,
  Lightbulb,
  Package,
  Target,
} from 'lucide-react'
import type { Locale } from '@/i18n/shared'

export type MatcherPhase = 'request' | 'fanOut' | 'straighten' | 'chat'

export const MATCHER_PHASE_MS: Record<MatcherPhase, number> = {
  request: 1000,
  fanOut: 1100,
  straighten: 800,
  chat: 2600,
}

export const MATCHER_MAX_CONCURRENT = 4
export const MATCHER_SPAWN_MIN_MS = 700
export const MATCHER_SPAWN_MAX_MS = 1800

export type MatchEvent = {
  id: string
  requestorIdx: number
  providerIdx: number
  startedAt: number
}

export type MatchEventSnapshot = {
  event: MatchEvent
  phase: MatcherPhase
  progress: number
}

export function getMatchEventSnapshot(event: MatchEvent, now: number): MatchEventSnapshot | null {
  const elapsed = now - event.startedAt
  let offset = 0

  const phases: MatcherPhase[] = ['request', 'fanOut', 'straighten', 'chat']
  for (const phase of phases) {
    const duration = MATCHER_PHASE_MS[phase]
    if (elapsed < offset + duration) {
      return { event, phase, progress: (elapsed - offset) / duration }
    }
    offset += duration
  }

  return null
}

export function createMatchEvent(actorCount: number, now: number): MatchEvent {
  const pair = pickMatchPair(actorCount)
  return {
    id: `match-${now}-${Math.random().toString(36).slice(2, 7)}`,
    requestorIdx: pair.requestor,
    providerIdx: pair.provider,
    startedAt: now,
  }
}

export type MatcherOfferTypeId =
  | 'question'
  | 'money'
  | 'product'
  | 'education'
  | 'job'
  | 'partnership'
  | 'goal'
  | 'idea'

export type MatcherOfferType = {
  id: MatcherOfferTypeId
  icon: LucideIcon
  color: string
  emoji: string
  label: Record<Locale, string>
}

/** Opportunity-type symbols carried over from RingAISynapseFlow */
export const MATCHER_OFFER_TYPES: MatcherOfferType[] = [
  {
    id: 'question',
    icon: HelpCircle,
    color: '#3b82f6',
    emoji: '❓',
    label: { en: 'Question', uk: 'Запит', ru: 'Вопрос' },
  },
  {
    id: 'money',
    icon: DollarSign,
    color: '#10b981',
    emoji: '💰',
    label: { en: 'Funding', uk: 'Фінанси', ru: 'Финансы' },
  },
  {
    id: 'product',
    icon: Package,
    color: '#f59e0b',
    emoji: '📦',
    label: { en: 'Product', uk: 'Продукт', ru: 'Продукт' },
  },
  {
    id: 'education',
    icon: GraduationCap,
    color: '#8b5cf6',
    emoji: '🎓',
    label: { en: 'Education', uk: 'Освіта', ru: 'Образование' },
  },
  {
    id: 'job',
    icon: Briefcase,
    color: '#6366f1',
    emoji: '💼',
    label: { en: 'Job', uk: 'Робота', ru: 'Работа' },
  },
  {
    id: 'partnership',
    icon: Handshake,
    color: '#ec4899',
    emoji: '🤝',
    label: { en: 'Partnership', uk: 'Партнерство', ru: 'Партнёрство' },
  },
  {
    id: 'goal',
    icon: Target,
    color: '#ef4444',
    emoji: '🎯',
    label: { en: 'Goal', uk: 'Ціль', ru: 'Цель' },
  },
  {
    id: 'idea',
    icon: Lightbulb,
    color: '#eab308',
    emoji: '💡',
    label: { en: 'Idea', uk: 'Ідея', ru: 'Идея' },
  },
]

export type MatcherActor = {
  id: string
  name: string
  angle: number
  offerId: MatcherOfferTypeId
  color: string
}

export const MATCHER_ACTORS: MatcherActor[] = [
  { id: 'a1', name: 'Anna', angle: -70, offerId: 'job', color: '#10b981' },
  { id: 'a2', name: 'Dmytro', angle: -10, offerId: 'product', color: '#3b82f6' },
  { id: 'a3', name: 'Olena', angle: 50, offerId: 'education', color: '#8b5cf6' },
  { id: 'a4', name: 'Ivan', angle: 110, offerId: 'partnership', color: '#ec4899' },
  { id: 'a5', name: 'Sofia', angle: 170, offerId: 'idea', color: '#f59e0b' },
  { id: 'a6', name: 'Max', angle: 230, offerId: 'money', color: '#ef4444' },
]
export type MatcherOrchestrationCopy = {
  title: string
  subtitle: string
  matcherLabel: string
  offerLabel: string
  phaseRequest: string
  phaseMatch: string
  phaseConnect: string
  phaseChat: string
  eventRequest: string
  eventOffer: string
  eventMatch: string
  eventMessage: string
  pause: string
  play: string
}

export const matcherOrchestrationCopy: Record<Locale, MatcherOrchestrationCopy> = {
  en: {
    title: 'AI Matcher orchestration',
    subtitle: 'Many requests run in parallel — the matcher routes, straightens, and opens DMs continuously.',
    matcherLabel: 'AI Matcher',
    offerLabel: 'Offers',
    phaseRequest: 'Request in',
    phaseMatch: 'Routing match',
    phaseConnect: 'Direct connection',
    phaseChat: 'Messaging',
    eventRequest: 'Request',
    eventOffer: 'Offer',
    eventMatch: 'Match',
    eventMessage: 'DM',
    pause: 'Pause',
    play: 'Play',
  },
  uk: {
    title: 'AI-оркестрація підбору',
    subtitle: 'Багато запитів паралельно — matcher маршрутизує, вирівнює лінії й відкриває DM без пауз.',
    matcherLabel: 'AI Matcher',
    offerLabel: 'Пропонує',
    phaseRequest: 'Запит',
    phaseMatch: 'Маршрутизація',
    phaseConnect: 'Прямий зв’язок',
    phaseChat: 'Повідомлення',
    eventRequest: 'Запит',
    eventOffer: 'Пропозиція',
    eventMatch: 'Збіг',
    eventMessage: 'DM',
    pause: 'Пауза',
    play: 'Грати',
  },
  ru: {
    title: 'AI-оркестрация подбора',
    subtitle: 'Много запросов параллельно — matcher маршрутизирует, выравнивает линии и открывает DM без пауз.',
    matcherLabel: 'AI Matcher',
    offerLabel: 'Предлагает',
    phaseRequest: 'Запрос',
    phaseMatch: 'Маршрутизация',
    phaseConnect: 'Прямая связь',
    phaseChat: 'Сообщения',
    eventRequest: 'Запрос',
    eventOffer: 'Предложение',
    eventMatch: 'Подбор',
    eventMessage: 'DM',
    pause: 'Пауза',
    play: 'Играть',
  },
}

export function getOfferType(id: MatcherOfferTypeId): MatcherOfferType {
  return MATCHER_OFFER_TYPES.find((t) => t.id === id) ?? MATCHER_OFFER_TYPES[0]
}

export function polarPoint(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  }
}

export function pickMatchPair(actorCount: number): { requestor: number; provider: number } {
  const requestor = Math.floor(Math.random() * actorCount)
  let provider = Math.floor(Math.random() * actorCount)
  while (provider === requestor) {
    provider = Math.floor(Math.random() * actorCount)
  }
  return { requestor, provider }
}

/** @deprecated Single-event FSM — use getMatchEventSnapshot for parallel events */
export function nextMatcherPhase(phase: MatcherPhase | 'idle'): MatcherPhase | 'idle' {
  switch (phase) {
    case 'idle':
      return 'request'
    case 'request':
      return 'fanOut'
    case 'fanOut':
      return 'straighten'
    case 'straighten':
      return 'chat'
    default:
      return 'idle'
  }
}
