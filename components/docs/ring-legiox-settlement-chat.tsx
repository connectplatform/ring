'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ExternalLink, FileAudio, ImageIcon, Paperclip, Send, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SettlementChatLocale = 'en' | 'uk' | 'ru'

/** Settlement entry on Ringdom — `/new` until protected settler chat ships on ring-ringdom-org. */
export const RINGDOM_SETTLEMENT_NEW_URL = 'https://ringdom.org/new'

const THINKING_MS = 2000

type ChatCopy = {
  headerTitle: string
  headerSubtitle: string
  agentName: string
  agentRole: string
  attachFile: string
  attachImage: string
  attachmentName: string
  userPrompt: string
  /** Full Reggie reply streamed after thinking dots (plain text; newlines preserved). */
  agentReply: string
  ctaLabel: string
  composingLabel: string
  youLabel: string
}

const chatCopy: Record<SettlementChatLocale, ChatCopy> = {
  en: {
    headerTitle: 'New Ring settlement',
    headerSubtitle: 'Same chat on legiox.pro · hosted on ringdom.org',
    agentName: 'Reggie',
    agentRole: 'LegioX agent',
    attachFile: 'Attach file',
    attachImage: 'Attach image',
    attachmentName: 'rancho-amigo-hoa-meeting.m4a',
    userPrompt:
      'We are looking to gather a home owners network in our HOA in North Scottsdale. We are called the Rancho Amigo HOA. This morning we had a meeting — attached is an audio recording of all the features we want to see in our app.',
    agentReply:
      'We value your interest. Here is what you can get running for less than 130 RING (or $1500 if paid via card or PayPal): a RanchoAmigo.app — your HOA network app with:\n\n• a board of requests\n• messenger for neighbours\n• feed of HOA events\n• a showcase of HOA services with direct ordering\n\nRingdom is your host base.',
    ctaLabel: 'Launch App on Ringdom',
    composingLabel: 'Describe your Ring vision…',
    youLabel: 'You',
  },
  uk: {
    headerTitle: 'Нове поселення Ring',
    headerSubtitle: 'Той самий чат на legiox.pro · хостинг на ringdom.org',
    agentName: 'Reggie',
    agentRole: 'Агент LegioX',
    attachFile: 'Додати файл',
    attachImage: 'Додати зображення',
    attachmentName: 'rancho-amigo-hoa-meeting.m4a',
    userPrompt:
      'We are looking to gather a home owners network in our HOA in North Scottsdale. We are called the Rancho Amigo HOA. This morning we had a meeting — attached is an audio recording of all the features we want to see in our app.',
    agentReply:
      'Дякуємо за інтерес. Ось що можна запустити менш ніж за 130 RING (або $1500 карткою чи PayPal): RanchoAmigo.app — мережа HOA з:\n\n• дошкою запитів\n• месенджером для сусідів\n• стрічкою подій HOA\n• вітриною послуг HOA з прямим замовленням\n\nRingdom — ваша хост-база.',
    ctaLabel: 'Запустити застосунок на Ringdom',
    composingLabel: 'Опишіть бачення Ring…',
    youLabel: 'Ви',
  },
  ru: {
    headerTitle: 'Новое поселение Ring',
    headerSubtitle: 'Тот же чат на legiox.pro · хостинг на ringdom.org',
    agentName: 'Reggie',
    agentRole: 'Агент LegioX',
    attachFile: 'Прикрепить файл',
    attachImage: 'Прикрепить изображение',
    attachmentName: 'rancho-amigo-hoa-meeting.m4a',
    userPrompt:
      'We are looking to gather a home owners network in our HOA in North Scottsdale. We are called the Rancho Amigo HOA. This morning we had a meeting — attached is an audio recording of all the features we want to see in our app.',
    agentReply:
      'Мы ценим ваш интерес. Вот что можно запустить менее чем за 130 RING (или $1500 картой / PayPal): RanchoAmigo.app — сеть HOA с:\n\n• доской запросов\n• мессенджером для соседей\n• лентой событий HOA\n• витриной услуг HOA с прямым заказом\n\nRingdom — ваша хост-база.',
    ctaLabel: 'Запустить приложение на Ringdom',
    composingLabel: 'Опишите видение Ring…',
    youLabel: 'Вы',
  },
}

type Phase = 'composing' | 'sent' | 'attach' | 'thinking' | 'agent' | 'done'

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-0.5" aria-label="Thinking">
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500 [animation-delay:120ms]" />
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500 [animation-delay:240ms]" />
    </span>
  )
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return reduced
}

function useSequentialTypewriter(
  text: string,
  active: boolean,
  start: boolean,
  charMs = 18,
) {
  const reduced = usePrefersReducedMotion()
  const [value, setValue] = useState('')
  const indexRef = useRef(0)

  useEffect(() => {
    if (!active || !start) {
      indexRef.current = 0
      setValue('')
      return
    }

    if (reduced) {
      setValue(text)
      return
    }

    indexRef.current = 0
    setValue('')

    let timer = 0
    const tick = () => {
      indexRef.current += 1
      setValue(text.slice(0, indexRef.current))
      if (indexRef.current < text.length) {
        timer = window.setTimeout(tick, charMs)
      }
    }

    timer = window.setTimeout(tick, charMs)
    return () => window.clearTimeout(timer)
  }, [active, start, text, charMs, reduced])

  const done = text.length > 0 && value.length >= text.length
  return { value, done }
}

function openSettlementWindow() {
  window.open(RINGDOM_SETTLEMENT_NEW_URL, '_blank', 'noopener,noreferrer')
}

export interface RingLegioxSettlementChatPreviewProps {
  locale?: SettlementChatLocale
  /** When false, animation pauses and resets on next activation. */
  isActive?: boolean
  className?: string
}

export function RingLegioxSettlementChatPreview({
  locale = 'en',
  isActive = true,
  className,
}: RingLegioxSettlementChatPreviewProps) {
  const t = chatCopy[locale] ?? chatCopy.en
  const reduced = usePrefersReducedMotion()
  const [phase, setPhase] = useState<Phase>('composing')
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isActive) {
      setPhase('composing')
    }
  }, [isActive])

  const userTyping = useSequentialTypewriter(t.userPrompt, isActive, phase === 'composing')
  const agentTyping = useSequentialTypewriter(t.agentReply, isActive, phase === 'agent', 14)

  useEffect(() => {
    if (!isActive) return

    if (reduced) {
      setPhase('done')
      return
    }

    if (phase === 'composing' && userTyping.done) {
      const timer = window.setTimeout(() => setPhase('sent'), 350)
      return () => window.clearTimeout(timer)
    }
    if (phase === 'sent') {
      const timer = window.setTimeout(() => setPhase('attach'), 400)
      return () => window.clearTimeout(timer)
    }
    if (phase === 'attach') {
      const timer = window.setTimeout(() => setPhase('thinking'), 500)
      return () => window.clearTimeout(timer)
    }
    if (phase === 'thinking') {
      const timer = window.setTimeout(() => setPhase('agent'), THINKING_MS)
      return () => window.clearTimeout(timer)
    }
    if (phase === 'agent' && agentTyping.done) {
      setPhase('done')
    }
  }, [isActive, phase, userTyping.done, agentTyping.done, reduced])

  useEffect(() => {
    const el = logRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [phase, userTyping.value, agentTyping.value])

  const showUserBubble = phase !== 'composing' || (reduced && isActive)
  const showAttachment =
    phase === 'attach' ||
    phase === 'thinking' ||
    phase === 'agent' ||
    phase === 'done' ||
    (reduced && isActive)
  const showAgentRow =
    phase === 'thinking' || phase === 'agent' || phase === 'done' || (reduced && isActive)
  const showThinkingOnly = phase === 'thinking' && !reduced
  const showAgentText = phase === 'agent' || phase === 'done' || (reduced && isActive)
  const showCta = phase === 'done' || (reduced && isActive)
  const composerValue = phase === 'composing' && !reduced ? userTyping.value : ''
  const agentText = reduced ? t.agentReply : agentTyping.value

  return (
    <div
      id="ringdom-new-settlement-chat"
      className={cn(
        'overflow-hidden rounded-xl border border-indigo-500/25 bg-gradient-to-b from-indigo-500/8 to-background shadow-sm',
        className,
      )}
      aria-label={t.headerTitle}
    >
      <div className="flex items-center justify-between gap-3 border-b border-indigo-500/15 bg-indigo-500/5 px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            </span>
            <p className="truncate text-sm font-semibold text-foreground">
              LegioX.pro · {t.headerTitle}
            </p>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{t.headerSubtitle}</p>
        </div>
        <div className="hidden shrink-0 gap-2 text-[10px] font-medium sm:flex">
          <a
            href="https://legiox.pro"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-border bg-background/80 px-2 py-1 text-indigo-600 hover:underline dark:text-indigo-300"
          >
            legiox.pro
          </a>
          <a
            href={RINGDOM_SETTLEMENT_NEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-border bg-background/80 px-2 py-1 text-amber-700 hover:underline dark:text-amber-300"
          >
            ringdom.org/new
          </a>
        </div>
      </div>

      <div
        ref={logRef}
        className="flex max-h-[22rem] min-h-[14rem] flex-col gap-3 overflow-y-auto overscroll-contain p-3 sm:max-h-[26rem] sm:min-h-[16rem] sm:p-4"
        role="log"
        aria-live="polite"
      >
        {showUserBubble ? (
          <div className="flex flex-row-reverse gap-2.5 sm:gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-800 dark:text-amber-200"
              aria-hidden
            >
              U
            </span>
            <div className="min-w-0 max-w-[92%] flex-1 sm:max-w-[85%]">
              <p className="mb-1 text-right text-[11px] font-medium text-muted-foreground">
                {t.youLabel}
              </p>
              <div className="rounded-2xl rounded-tr-md border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-sm leading-relaxed text-foreground">
                {t.userPrompt}
                {showAttachment ? (
                  <span className="mt-2 flex items-center gap-1.5 rounded-lg border border-indigo-500/25 bg-background/60 px-2 py-1.5 text-[11px]">
                    <FileAudio className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-300" aria-hidden />
                    {t.attachmentName}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center py-6 text-xs text-muted-foreground/70">
            {t.composingLabel}
          </div>
        )}

        {showAgentRow ? (
          <div className="flex gap-2.5 sm:gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-xs font-bold text-indigo-700 dark:text-indigo-200"
              aria-hidden
            >
              R
            </span>
            <div className="min-w-0 max-w-[92%] flex-1 sm:max-w-[85%]">
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                {t.agentName}{' '}
                <span className="text-indigo-600/80 dark:text-indigo-300/80">· {t.agentRole}</span>
              </p>
              <div className="rounded-2xl rounded-tl-md border border-indigo-500/20 bg-indigo-500/10 px-3 py-2.5 text-sm leading-relaxed text-foreground">
                {showThinkingOnly ? (
                  <ThinkingDots />
                ) : showAgentText ? (
                  <>
                    <div className="whitespace-pre-wrap">
                      {agentText}
                      {phase === 'agent' && !agentTyping.done && !reduced ? (
                        <span
                          className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-indigo-500 align-middle"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    {showCta ? (
                      <button
                        type="button"
                        onClick={openSettlementWindow}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:bg-indigo-500 dark:hover:bg-indigo-400 sm:w-auto"
                      >
                        {t.ctaLabel}
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-border/80 bg-muted/20 p-3 sm:p-4">
        <div className="relative rounded-xl border border-border bg-background shadow-sm">
          <textarea
            id="ringdom-new-settlement-chat-text-area"
            readOnly
            rows={3}
            value={composerValue}
            placeholder={phase === 'composing' ? t.composingLabel : ''}
            className="w-full resize-none border-0 bg-transparent px-3 pb-10 pt-3 text-sm leading-relaxed text-foreground outline-none ring-0 placeholder:text-muted-foreground/60"
            aria-label={t.composingLabel}
          />
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 border-t border-border/60 px-2 py-1.5">
            <div className="flex items-center gap-0.5">
              <span
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground',
                  showAttachment && 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
                )}
                title={t.attachFile}
                aria-hidden
              >
                <Paperclip className="h-4 w-4" />
              </span>
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/50"
                title={t.attachImage}
                aria-hidden
              >
                <ImageIcon className="h-4 w-4" />
              </span>
            </div>
            <span
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-lg',
                userTyping.done || phase !== 'composing' || reduced
                  ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                  : 'bg-muted text-muted-foreground',
              )}
              aria-hidden
            >
              <Send className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
