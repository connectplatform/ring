'use server'

import { auth } from '@/auth'
import { isVaultKey } from '@/features/wiki/vault-key'
import { resolveWikiActor } from '@/features/wiki/resolve-wiki-actor'
import type { CreateWikiPageInput, UpdateWikiPageInput } from '@/features/wiki/types'
import * as WikiService from '@/features/wiki/wiki-service'

async function requireActor(orderId?: string) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Authentication required')
  }
  return resolveWikiActor({
    userId: session.user.id,
    role: session.user.role,
    orderId,
  })
}

export async function wikiListAction(vaultKey: string) {
  if (!isVaultKey(vaultKey)) throw new Error('Invalid vaultKey')
  const orderId = vaultKey.startsWith('po:') ? vaultKey.slice(3) : undefined
  const actor = await requireActor(orderId)
  await WikiService.ensureTenantSchema(actor)
  return WikiService.listPages(actor, vaultKey)
}

export async function wikiGetAction(id: string) {
  const actor = await requireActor()
  return WikiService.getPage(actor, id)
}

export async function wikiCreateAction(input: CreateWikiPageInput) {
  const orderId =
    input.vaultKey.startsWith('po:') ? input.vaultKey.slice(3) : undefined
  const actor = await requireActor(orderId)
  return WikiService.createPage(actor, input)
}

export async function wikiUpdateAction(id: string, input: UpdateWikiPageInput) {
  const actor = await requireActor()
  return WikiService.updatePage(actor, id, input)
}

export async function wikiDeleteAction(id: string) {
  const actor = await requireActor()
  await WikiService.deletePage(actor, id)
  return { ok: true }
}

export async function wikiSearchAction(
  query: string,
  vaultKey?: string,
  context?: string,
) {
  const vk = vaultKey && isVaultKey(vaultKey) ? vaultKey : undefined
  const orderId = vk?.startsWith('po:') ? vk.slice(3) : undefined
  const actor = await requireActor(orderId)
  return WikiService.searchPages(actor, query, { vaultKey: vk, context })
}

export async function wikiBacklinksAction(pageId: string) {
  const actor = await requireActor()
  return WikiService.getBacklinks(actor, pageId)
}

export async function wikiLintAction(vaultKey: string) {
  if (!isVaultKey(vaultKey)) throw new Error('Invalid vaultKey')
  const orderId = vaultKey.startsWith('po:') ? vaultKey.slice(3) : undefined
  const actor = await requireActor(orderId)
  return WikiService.lintVault(actor, vaultKey)
}

export async function wikiCreateMissingStubsAction(vaultKey: string) {
  if (!isVaultKey(vaultKey)) throw new Error('Invalid vaultKey')
  const orderId = vaultKey.startsWith('po:') ? vaultKey.slice(3) : undefined
  const actor = await requireActor(orderId)
  return WikiService.ensureMissingStubPages(actor, vaultKey)
}

export async function wikiEventsAction(vaultKey: string) {
  if (!isVaultKey(vaultKey)) throw new Error('Invalid vaultKey')
  const orderId = vaultKey.startsWith('po:') ? vaultKey.slice(3) : undefined
  const actor = await requireActor(orderId)
  return WikiService.listEvents(actor, vaultKey)
}

export async function wikiOpenProjectVaultAction(orderId: string) {
  const actor = await requireActor(orderId)
  return WikiService.ensureProjectVault(actor, orderId)
}

export async function wikiEnsureTenantAction() {
  const actor = await requireActor()
  return WikiService.ensureTenantSchema(actor)
}

// NOTE: Do not re-export types or sync helpers from 'use server' modules —
// Next treats every export as a server action; type-only re-exports become
// runtime `VaultKey is not defined` ReferenceErrors.
