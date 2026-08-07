/**
 * Shared media types — generative-media is SSOT; legacy MediaGalleryItem kept for deprecated NFT components.
 * @deprecated Prefer `@/features/generative-media/types`.
 */

export type {
  GalleryItem,
  NftShowcaseExtras,
  GenerativeGalleryValue,
} from '@/features/generative-media/types'

export {
  buildGenMediaChatKey,
  buildImageGenEditorChatKey,
  IMAGE_CONDUCTOR_SENDER_ID,
  IMAGE_CONDUCTOR_SENDER_NAME,
  GHOST_WRITE_SENDER_ID,
  GHOST_WRITE_SENDER_NAME,
  primaryGalleryUrl,
  displayGalleryUrl,
} from '@/features/generative-media/types'

/** @deprecated Use GalleryItem.originalUrl */
export type MediaGalleryItem = {
  id: string
  url: string
  fileId?: string
  contentType?: string
  source: 'upload' | 'generated'
  createdAt?: string
}
