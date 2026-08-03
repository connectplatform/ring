'use client'

/**
 * Agent Knowledge section — productAgent markdown + Admin Wiki NODUS link + Research FsModal.
 * Shared by vendor/admin ProductForm (edit mode).
 */

import { useCallback, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { BookOpen, Loader2, Sparkles, ExternalLink } from 'lucide-react'
import { FsModal } from '@/components/ui/fs-modal'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { ProductNodusWikiRef } from '@/features/store/types'
import type { WebProductFieldSuggestions } from '@/lib/web'
import type { ProductResearchMediaRef } from '@/features/store/lib/product-cabinet-media'
import {
  buildDefaultResearchPromptAction,
  researchProductAgentAction,
  researchProductDraftAction,
  saveProductAgentKnowledgeAction,
} from '@/app/_actions/product-agent-research'

type Props = {
  productId?: string
  vendorEntityId: string
  productName: string
  categoryName?: string
  description?: string
  initialProductAgent?: string
  initialNodusWiki?: ProductNodusWikiRef | null
  disabled?: boolean
  onUseResearchImage?: (media: ProductResearchMediaRef) => void
  onUpdated?: (next: {
    productAgent: string
    productNodusWiki?: ProductNodusWikiRef
    nodusJson?: Record<string, unknown>
    fields?: WebProductFieldSuggestions
    researchMedia?: ProductResearchMediaRef[]
  }) => void
}

export function ProductAgentKnowledgeSection({
  productId,
  vendorEntityId,
  productName,
  categoryName,
  description,
  initialProductAgent = '',
  initialNodusWiki,
  disabled,
  onUseResearchImage,
  onUpdated,
}: Props) {
  const locale = useLocale() as Locale
  const t = useTranslations('modules.store.agentKnowledge')
  const [markdown, setMarkdown] = useState(initialProductAgent)
  const [wiki, setWiki] = useState<ProductNodusWikiRef | null | undefined>(initialNodusWiki)
  const [researchOpen, setResearchOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [researchUrl, setResearchUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [suggestedFields, setSuggestedFields] = useState<WebProductFieldSuggestions | null>(null)
  const [researchMedia, setResearchMedia] = useState<ProductResearchMediaRef[]>([])
  const [nodusJson, setNodusJson] = useState<Record<string, unknown> | null>(null)
  const [cabinetPath, setCabinetPath] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const productUrl = useMemo(() => {
    if (!productId) return ''
    if (typeof window === 'undefined') {
      return ROUTES.STORE_PRODUCT(productId, locale)
    }
    return `${window.location.origin}${ROUTES.STORE_PRODUCT(productId, locale)}`
  }, [locale, productId])

  const openResearch = useCallback(() => {
    setError(null)
    setResearchOpen(true)
    startTransition(async () => {
      if (!productId) {
        setPrompt(
          `Research ${productName || 'this product'} in ${categoryName || 'General'} category. Search the web for verified product information, parameters, benefits, use-cases, caveats, usage instructions, and relevant source images.`,
        )
        return
      }
      const built = await buildDefaultResearchPromptAction({
        productId,
        productUrl,
      })
      if (built.error) {
        setError(built.error)
        setPrompt(
          `Read ${productUrl} about ${productName} of ${categoryName || 'General'} category. Search web for product information…`,
        )
        return
      }
      setPrompt(built.prompt || '')
    })
  }, [productId, productUrl, productName, categoryName])

  const runResearch = useCallback(() => {
    setError(null)
    startTransition(async () => {
      const result = productId
        ? await researchProductAgentAction({
            productId,
            productUrl: researchUrl.trim() || productUrl,
            customPrompt: prompt,
          })
        : await researchProductDraftAction({
            vendorEntityId,
            productName,
            categoryName,
            description,
            productUrl: researchUrl.trim() || undefined,
            customPrompt: prompt,
          })
      if (result.error || !result.success) {
        setError(result.error || 'Research failed')
        return
      }
      if (result.productAgent) {
        setMarkdown(result.productAgent)
      }
      if (result.productNodusWiki) {
        setWiki(result.productNodusWiki)
      }
      if (result.fields) setSuggestedFields(result.fields)
      if (result.researchMedia?.length) {
        setResearchMedia((previous) => [...previous, ...result.researchMedia!])
      }
      if (result.nodusJson) setNodusJson(result.nodusJson)
      if (result.cabinetPath) setCabinetPath(result.cabinetPath)
      onUpdated?.({
        productAgent: result.productAgent || markdown,
        productNodusWiki: result.productNodusWiki,
        nodusJson: result.nodusJson,
        fields: result.fields,
        researchMedia: result.researchMedia,
      })
      setResearchOpen(false)
    })
  }, [
    productId,
    productUrl,
    researchUrl,
    prompt,
    vendorEntityId,
    productName,
    categoryName,
    description,
    onUpdated,
    markdown,
  ])

  const saveMarkdown = useCallback(() => {
    setError(null)
    startTransition(async () => {
      const result = await saveProductAgentKnowledgeAction({
        productId,
        productAgent: markdown,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      onUpdated?.({ productAgent: markdown, productNodusWiki: wiki || undefined })
    })
  }, [productId, markdown, wiki, onUpdated])

  const wikiHref = wiki?.wikiPageId
    ? ROUTES.ADMIN_WIKI_PAGE(wiki.wikiPageId, locale)
    : null

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4 text-primary" />
          {t('title', { defaultValue: 'Agent Knowledge' })}
        </CardTitle>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled || pending}
          onClick={openResearch}
          className="gap-1.5"
        >
          {pending && researchOpen ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {t('research', { defaultValue: 'Research' })}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {t('hint', {
            defaultValue:
              'Human-friendly markdown for the product sales agent. Full NODUS lives in Admin Wiki.',
          })}
        </p>
        {/* Hidden fields so parent form save also persists knowledge when present */}
        <input type="hidden" name="productAgent" value={markdown} />
        {nodusJson ? (
          <input type="hidden" name="productNodusDraft" value={JSON.stringify(nodusJson)} />
        ) : null}
        {suggestedFields ? (
          <input
            type="hidden"
            name="productResearchFields"
            value={JSON.stringify(suggestedFields)}
          />
        ) : null}
        {researchMedia.length ? (
          <input
            type="hidden"
            name="productResearchMedia"
            value={JSON.stringify(researchMedia)}
          />
        ) : null}
        {wiki?.wikiPageId ? (
          <input type="hidden" name="productNodusWikiPageId" value={wiki.wikiPageId} />
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="productAgentMarkdown">
            {t('markdownLabel', { defaultValue: 'Product agent markdown' })}
          </Label>
          <Textarea
            id="productAgentMarkdown"
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            rows={10}
            disabled={disabled || pending}
            placeholder={t('markdownPlaceholder', {
              defaultValue: 'Run Research or paste the linear sales brief…',
            })}
            className="font-mono text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {productId ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || pending}
              onClick={saveMarkdown}
            >
              {pending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              {t('save', { defaultValue: 'Save knowledge' })}
            </Button>
          ) : null}
          {wikiHref ? (
            <Button type="button" size="sm" variant="link" asChild className="h-auto px-1">
              <Link href={wikiHref} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                {t('openWiki', { defaultValue: 'Open NODUS wiki' })}
              </Link>
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              {t('noWikiYet', { defaultValue: 'No NODUS wiki page yet — run Research.' })}
            </span>
          )}
        </div>

        {suggestedFields ? (
          <div className="rounded-md border bg-background/60 p-3 text-xs">
            <p className="font-medium">
              {t('fieldsApplied', { defaultValue: 'Research suggestions applied to the form' })}
            </p>
            <p className="mt-1 text-muted-foreground">
              {suggestedFields.name} · {suggestedFields.category || categoryName || 'General'} ·{' '}
              {suggestedFields.specifications.length}{' '}
              {t('parameters', { defaultValue: 'parameters' })}
            </p>
          </div>
        ) : null}

        {researchMedia.length ? (
          <div className="space-y-2">
            <p className="text-xs font-medium">
              {t('researchImages', { defaultValue: 'Research image alternatives' })}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {researchMedia.slice(-6).map((item) => (
                <div key={item.id} className="overflow-hidden rounded-md border bg-muted">
                  {/* Product-ready RingBase URL; vendor chooses whether to enable it in gallery. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.storageUrl}
                    alt={item.alt}
                    className="aspect-square w-full object-cover"
                  />
                  {onUseResearchImage ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-full rounded-none text-[11px]"
                      onClick={() => onUseResearchImage(item)}
                    >
                      {t('useInGallery', { defaultValue: 'Use in gallery' })}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            {cabinetPath ? (
              <p className="text-[11px] text-muted-foreground">
                {t('savedToCabinet', {
                  path: cabinetPath,
                  defaultValue: `Saved to ${cabinetPath}`,
                })}
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <FsModal
          open={researchOpen}
          onOpenChange={setResearchOpen}
          title={t('researchTitle', { defaultValue: 'Research product agent' })}
          description={t('researchDescription', {
            defaultValue:
              'Uses TextConductor with web search (same path as news generate-article). Writes productAgent markdown + Admin Wiki NODUS.',
          })}
          className="sm:max-w-2xl"
          footer={
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setResearchOpen(false)}>
                {t('cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button type="button" disabled={pending || !prompt.trim()} onClick={runResearch}>
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {t('runResearch', { defaultValue: 'Run Research' })}
              </Button>
            </div>
          }
        >
          <Label htmlFor="researchProductUrl" className="mb-2 block">
            {t('productUrlLabel', { defaultValue: 'Source product URL (optional)' })}
          </Label>
          <Textarea
            id="researchProductUrl"
            value={researchUrl}
            onChange={(e) => setResearchUrl(e.target.value)}
            rows={2}
            placeholder="https://manufacturer.example/product"
            className="mb-4 font-mono text-xs"
            disabled={pending}
          />
          <Label htmlFor="researchPrompt" className="mb-2 block">
            {t('promptLabel', { defaultValue: 'Research request' })}
          </Label>
          <Textarea
            id="researchPrompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={14}
            className="font-mono text-xs"
            disabled={pending}
          />
          {/* TODO: Optional auto-enrich on product approve */}
          {/* TODO: Optional nightly ProcessConductor enrichment for stale productAgent */}
        </FsModal>
      </CardContent>
    </Card>
  )
}

export default ProductAgentKnowledgeSection
