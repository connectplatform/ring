/**
 * Optional TipTap + Yjs collaboration hook-up for news (gated).
 * Wire into TipTapNewsEditor when NEXT_PUBLIC_COLLAB_ENABLED=true and native WSS is live.
 * Reuses hooks/use-collaboration.ts with channel collab:news:{articleId}.
 * Requires @tiptap/extension-collaboration + collaboration-caret (install when enabling).
 */

export const NEWS_COLLAB_CHANNEL_PREFIX = 'collab:news:'

export function newsCollabChannel(articleId: string): string {
  return `${NEWS_COLLAB_CHANNEL_PREFIX}${articleId}`
}

export function isNewsCollabEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_COLLAB_ENABLED === 'true'
  )
}
