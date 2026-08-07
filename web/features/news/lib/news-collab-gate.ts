/**
 * News collaboration gate — Markdown SSOT via Y.Text (WikiRichEditor / NewsRichEditor).
 * TipTap Collaboration extensions are not required; sync is plain-text CRDT on the body.
 *
 * Enable: NEXT_PUBLIC_COLLAB_ENABLED=true + native WSS deploy target.
 * Channel: collab:news:{articleId} (via useCollaboration(`news:${articleId}`)).
 */

export const NEWS_COLLAB_CHANNEL_PREFIX = 'collab:news:'

/** Y.Text key inside the shared doc for article markdown body. */
export const NEWS_COLLAB_YTEXT_KEY = 'newsMarkdown'

export function newsCollabChannel(articleId: string): string {
  return `${NEWS_COLLAB_CHANNEL_PREFIX}${articleId}`
}

export function isNewsCollabEnabled(): boolean {
  return process.env.NEXT_PUBLIC_COLLAB_ENABLED === 'true'
}
