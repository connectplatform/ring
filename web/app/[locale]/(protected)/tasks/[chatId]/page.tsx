import type { Metadata } from 'next'
import { Suspense } from 'react'
import { setRequestLocale } from 'next-intl/server'
import { auth as getAuthSession } from '@/auth'
import type { Session } from 'next-auth'
import { LocalePageProps } from '@/utils/page-props'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { ROUTES } from '@/constants/routes'
import { localizedRedirect } from '@/lib/i18n-server-redirect'
import { connection } from 'next/server'
import { getConversationTitle } from '@/features/chat/lib/conversation-display'
import { ConversationService } from '@/features/chat/services/conversation-service'
import { listTasksForConversation } from '@/features/tasks/services/task-query-service'
import { TasksChatList } from '@/features/tasks/components/tasks-chat-list'

type TasksChatParams = { chatId: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; chatId: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'tasks.chat',
    pathname: '/tasks/[chatId]',
    robots: { index: false, follow: false },
  })
}

export default async function TasksChatPage(props: LocalePageProps<TasksChatParams>) {
  await connection()

  const params = await props.params
  const validLocale: Locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : (routing.defaultLocale as Locale)
  const chatId = String(params.chatId || '').trim()

  const authSession = (await getAuthSession()) as Session | null
  if (!authSession?.user) {
    localizedRedirect({
      locale: validLocale,
      href: '/login',
      query: {
        callbackUrl: ROUTES.TASK(chatId, validLocale),
      },
    })
  }

  const userId = authSession!.user!.id as string
  const conversations = new ConversationService()
  const conversation = await conversations.getConversationById(chatId, userId)

  if (!conversation) {
    localizedRedirect({
      locale: validLocale,
      href: '/tasks',
    })
  }

  const tasks = await listTasksForConversation(userId, chatId)
  const title = getConversationTitle(conversation!, userId)

  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <TasksChatList conversationId={chatId} conversationTitle={title} tasks={tasks} />
    </Suspense>
  )
}
