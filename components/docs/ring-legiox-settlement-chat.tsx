'use client'

import React, { useEffect, useRef, useState } from 'react'
import { FileAudio, ImageIcon, Paperclip, Send, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SettlementChatLocale = 'en' | 'uk' | 'ru'

type ChatCopy = {
  headerTitle: string
  headerSubtitle: string
  agentName: string
  agentRole: string
  attachFile: string
  attachImage: string
  attachmentName: string
  userPrompt: string
  agentReply: string
  composingLabel: string
}

const chatCopy: Record<SettlementChatLocale, ChatCopy> = {
  en: {
    headerTitle: 'New Ring settlement',
    headerSubtitle: 'Same chat on legiox.pro · hosted on ringdom.org',
    agentName: 'Reggie',
    agentRole: 'LegioX agent',
    attachFile: 'Attach file',
    attachImage: 'Attach image',
    attachmentName: 'racho-amigo-hoa-meeting.m4a',
    userPrompt:
      'We are looking to gather a home owners network in our HOA in North Scottsdale. We are called the Racho Amigo HOA, this morning we had a meeting, attached is an audio recording of all the features we want to see in our app.',
    agentReply:
      'Thank you for your detailed request! While the audio is transcribing I already understand the features you guys need which will immediately work, and I found info about your HOA online. Let me ask you three quick questions...',
    composingLabel: 'Describe your Ring vision…',
  },
  uk: {
    headerTitle: 'Нове поселення Ring',
    headerSubtitle: 'Той самий чат на legiox.pro · хостинг на ringdom.org',
    agentName: 'Reggie',
    agentRole: 'Агент LegioX',
    attachFile: 'Додати файл',
    attachImage: 'Додати зображення',
    attachmentName: 'racho-amigo-hoa-meeting.m4a',
    userPrompt:
      'We are looking to gather a home owners network in our HOA in North Scottsdale. We are called the Racho Amigo HOA, this morning we had a meeting, attached is an audio recording of all the features we want to see in our app.',
    agentReply:
      'Thank you for your detailed request! While the audio is transcribing I already understand the features you guys need which will immediately work, and I found info about your HOA online. Let me ask you three quick questions...',
    composingLabel: 'Опишіть бачення Ring…',
  },
  ru: {
    headerTitle: 'Новое поселение Ring',
    headerSubtitle: 'Тот же чат на legiox.pro · хостинг на ringdom.org',
    agentName: 'Reggie',
    agentRole: 'Агент LegioX',
    attachFile: 'Прикрепить файл',
    attachImage: 'Прикрепить изображение',
    attachmentName: 'racho-amigo-hoa-meeting.m4a',
    userPrompt:
      'We are looking to gather a home owners network in our HOA in North Scottsdale. We are called the Racho Amigo HOA, this morning we had a meeting, attached is an audio recording of all the features we want to see in our app.',
    agentReply:
      'Thank you for your detailed request! While the audio is transcribing I already understand the features you guys need which will immediately work, and I found info about your HOA online. Let me ask you three quick questions...',
    composingLabel: 'Опишите видение Ring…',
  },
}

type Phase = 'user' | 'attach' | 'agent' | 'done'

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
  charMs = 22,
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

    const tick = () => {
      indexRef.current += 1
      setValue(text.slice(0, indexRef.current))
      if (indexRef.current < text.length) {
        timer = window.setTimeout(tick, charMs)
      }
    }

    let timer = window.setTimeout(tick, charMs)
    return () => window.clearTimeout(timer)
  }, [active, start, text, charMs, reduced])

  const done = value.length >= text.length && text.length > 0
  return { value, done }
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
  const [phase, setPhase] = useState<Phase>('user')

  useEffect(() => {
    if (!isActive) {
      setPhase('user')
    }
  }, [isActive])

  const userTyping = useSequentialTypewriter(t.userPrompt, isActive, phase === 'user')
  const agentTyping = useSequentialTypewriter(t.agentReply, isActive, phase === 'agent', 18)

  useEffect(() => {
    if (!isActive || reduced) {
      if (isActive && reduced) setPhase('done')
      return
    }
    if (phase === 'user' && userTyping.done) {
      const timer = window.setTimeout(() => setPhase('attach'), 400)
      return () => window.clearTimeout(timer)
    }
    if (phase === 'attach') {
      const timer = window.setTimeout(() => setPhase('agent'), 700)
      return () => window.clearTimeout(timer)
    }
    if (phase === 'agent' && agentTyping.done) {
      setPhase('done')
    }
  }, [isActive, phase, userTyping.done, agentTyping.done, reduced])

  const showAgent = phase === 'agent' || phase === 'done' || (reduced && isActive)
  const showAttachment = phase === 'attach' || phase === 'agent' || phase === 'done' || (reduced && isActive)
  const textareaValue = reduced && isActive ? t.userPrompt : userTyping.value
  const agentValue = reduced && isActive ? t.agentReply : agentTyping.value

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
            href="https://ringdom.org"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-border bg-background/80 px-2 py-1 text-amber-700 hover:underline dark:text-amber-300"
          >
            ringdom.org
          </a>
        </div>
      </div>

      <div className="flex min-h-[11rem] flex-col gap-3 p-3 sm:min-h-[12rem] sm:p-4">
        {showAgent ? (
          <div className="flex gap-2.5 sm:gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-xs font-bold text-indigo-700 dark:text-indigo-200"
              aria-hidden
            >
              R
            </span>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                {t.agentName}{' '}
                <span className="text-indigo-600/80 dark:text-indigo-300/80">· {t.agentRole}</span>
              </p>
              <div className="rounded-2xl rounded-tl-md border border-indigo-500/20 bg-indigo-500/10 px-3 py-2.5 text-sm leading-relaxed text-foreground">
                {agentValue}
                {phase === 'agent' && !agentTyping.done && !reduced ? (
                  <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-indigo-500 align-middle" aria-hidden />
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground/70">
            {t.composingLabel}
          </div>
        )}
      </div>

      <div className="border-t border-border/80 bg-muted/20 p-3 sm:p-4">
        {showAttachment ? (
          <div className="mb-2 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/25 bg-indigo-500/8 px-2 py-1 text-[11px] text-foreground">
              <FileAudio className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-300" aria-hidden />
              {t.attachmentName}
            </span>
          </div>
        ) : null}

        <div className="relative rounded-xl border border-border bg-background shadow-sm">
          <textarea
            id="ringdom-new-settlement-chat-text-area"
            readOnly
            rows={4}
            value={textareaValue}
            placeholder={t.composingLabel}
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
                userTyping.done || reduced
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
