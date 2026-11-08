'use client'

import React, { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { davinciGlassSurface } from '@/lib/ui/davinci'
import { DistrictSelect, listCityDistricts } from '@/components/profile/district-select'
import { OrganizationEntitySelect } from '@/components/profile/organization-entity-select'
import { PositionTagCloud } from '@/components/profile/position-tag-cloud'
import { SkillsTagCloud } from '@/components/profile/skills-tag-cloud'
import { PhoneOtpPanel } from '@/features/auth/components/phone-otp-panel'
import { isTelegramLinked } from '@/lib/auth/telegram-profile'
import type { AuthUser } from '@/features/auth/types'

export type ProfilePatch = Record<string, unknown>

interface ProfileUnfilledInboxProps {
  user: AuthUser
  realEmail: string | null
  hasPhoto: boolean
  onSave: (patch: ProfilePatch) => Promise<boolean>
  onDismiss: (blockId: string) => Promise<boolean>
  onOpenUsername: () => void
  onOpenEmail: () => void
  onOpenLocation: () => void
  onOpenTimezone: () => void
  onOpenTelegram: () => void
  onAvatarFile: (file: File) => void
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function dismissalsOf(user: AuthUser): string[] {
  const raw = user.profilePromptDismissals
  if (!Array.isArray(raw)) return []
  return raw.filter((id): id is string => typeof id === 'string')
}

function BlockFrame({
  title,
  tabLabel,
  children,
}: {
  title: string
  tabLabel: string
  children: React.ReactNode
}) {
  const t = useTranslations('modules.profile')
  return (
    <section className={cn(davinciGlassSurface, 'space-y-3 p-4')}>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{t('fromTab', { tab: tabLabel })}</p>
      </div>
      {children}
    </section>
  )
}

function BlockActions({
  onSave,
  onDismiss,
  busy,
  showSave = true,
  saveDisabled = false,
}: {
  onSave?: () => void
  onDismiss: () => void
  busy: boolean
  showSave?: boolean
  saveDisabled?: boolean
}) {
  const t = useTranslations('modules.profile')
  return (
    <div className="flex flex-wrap gap-2">
      {showSave && onSave ? (
        <Button type="button" size="sm" onClick={onSave} disabled={busy || saveDisabled}>
          {t('save')}
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="outline" onClick={onDismiss} disabled={busy}>
        {t('closeAndDismiss')}
      </Button>
    </div>
  )
}

export function ProfileUnfilledInbox({
  user,
  realEmail,
  hasPhoto,
  onSave,
  onDismiss,
  onOpenUsername,
  onOpenEmail,
  onOpenLocation,
  onOpenTimezone,
  onOpenTelegram,
  onAvatarFile,
}: ProfileUnfilledInboxProps) {
  const t = useTranslations('modules.profile')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState(textOf(user.name))
  const [bioDraft, setBioDraft] = useState(textOf(user.bio))
  const [whatsappDraft, setWhatsappDraft] = useState(
    textOf(user.communication?.whatsappNumber),
  )
  const [instagramDraft, setInstagramDraft] = useState(
    textOf(user.communication?.instagramUsername),
  )
  const [districtDraft, setDistrictDraft] = useState(textOf(user.cultural?.district))

  const dismissed = useMemo(() => new Set(dismissalsOf(user)), [user])
  const cityHasDistricts = listCityDistricts().length > 0

  const run = async (id: string, task: () => Promise<boolean>) => {
    setBusyId(id)
    try {
      await task()
    } finally {
      setBusyId(null)
    }
  }

  const blocks: Array<{ id: string; node: React.ReactNode } | null> = [
    !textOf(user.name)
      ? {
          id: 'name',
          node: (
            <BlockFrame title={t('addName')} tabLabel={t('overview')}>
              <Input
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                placeholder={t('namePlaceholder')}
              />
              <BlockActions
                busy={busyId === 'name'}
                saveDisabled={!nameDraft.trim()}
                onDismiss={() => void run('name', () => onDismiss('name'))}
                onSave={() =>
                  void run('name', () => onSave({ name: nameDraft.trim() }))
                }
              />
            </BlockFrame>
          ),
        }
      : null,
    !textOf(user.username)
      ? {
          id: 'username',
          node: (
            <BlockFrame title={t('username')} tabLabel={t('communications')}>
              <Button type="button" size="sm" onClick={onOpenUsername}>
                {t('setUsername')}
              </Button>
              <BlockActions
                showSave={false}
                busy={busyId === 'username'}
                onDismiss={() => void run('username', () => onDismiss('username'))}
              />
            </BlockFrame>
          ),
        }
      : null,
    !hasPhoto
      ? {
          id: 'photo',
          node: (
            <BlockFrame title={t('addPhoto')} tabLabel={t('overview')}>
              <Input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) onAvatarFile(file)
                }}
              />
              <BlockActions
                showSave={false}
                busy={busyId === 'photo'}
                onDismiss={() => void run('photo', () => onDismiss('photo'))}
              />
            </BlockFrame>
          ),
        }
      : null,
    !realEmail
      ? {
          id: 'email',
          node: (
            <BlockFrame title={t('email')} tabLabel={t('communications')}>
              <Button type="button" size="sm" onClick={onOpenEmail}>
                {t('linkEmail')}
              </Button>
              <BlockActions
                showSave={false}
                busy={busyId === 'email'}
                onDismiss={() => void run('email', () => onDismiss('email'))}
              />
            </BlockFrame>
          ),
        }
      : null,
    !textOf(user.phoneNumber)
      ? {
          id: 'phone',
          node: (
            <BlockFrame title={t('phone') || 'Phone'} tabLabel={t('communications')}>
              <PhoneOtpPanel
                initialPhone={user.phoneNumber || user.communication?.phoneNumber || null}
                phoneVerifiedAt={user.phoneVerifiedAt || null}
              />
              <BlockActions
                showSave={false}
                busy={busyId === 'phone'}
                onDismiss={() => void run('phone', () => onDismiss('phone'))}
              />
            </BlockFrame>
          ),
        }
      : null,
    !isTelegramLinked(user.communication)
      ? {
          id: 'telegram',
          node: (
            <BlockFrame title={t('telegramAccount')} tabLabel={t('communications')}>
              <Button type="button" size="sm" onClick={onOpenTelegram}>
                {t('addTelegramAccount')}
              </Button>
              <BlockActions
                showSave={false}
                busy={busyId === 'telegram'}
                onDismiss={() => void run('telegram', () => onDismiss('telegram'))}
              />
            </BlockFrame>
          ),
        }
      : null,
    !textOf(user.communication?.whatsappNumber)
      ? {
          id: 'whatsapp',
          node: (
            <BlockFrame title={t('whatsappAccount')} tabLabel={t('communications')}>
              <Input
                value={whatsappDraft}
                onChange={(event) => setWhatsappDraft(event.target.value)}
                placeholder={t('inputPlaceholder', { platform: 'WhatsApp' })}
              />
              <BlockActions
                busy={busyId === 'whatsapp'}
                saveDisabled={!whatsappDraft.trim()}
                onDismiss={() => void run('whatsapp', () => onDismiss('whatsapp'))}
                onSave={() =>
                  void run('whatsapp', () =>
                    onSave({
                      communication: { whatsappNumber: whatsappDraft.trim() },
                    }),
                  )
                }
              />
            </BlockFrame>
          ),
        }
      : null,
    !textOf(user.communication?.instagramUsername)
      ? {
          id: 'instagram',
          node: (
            <BlockFrame title={t('instagramAccount')} tabLabel={t('communications')}>
              <Input
                value={instagramDraft}
                onChange={(event) => setInstagramDraft(event.target.value)}
                placeholder={t('inputPlaceholder', { platform: 'Instagram' })}
              />
              <BlockActions
                busy={busyId === 'instagram'}
                saveDisabled={!instagramDraft.trim()}
                onDismiss={() => void run('instagram', () => onDismiss('instagram'))}
                onSave={() =>
                  void run('instagram', () =>
                    onSave({
                      communication: { instagramUsername: instagramDraft.trim() },
                    }),
                  )
                }
              />
            </BlockFrame>
          ),
        }
      : null,
    !textOf(user.bio)
      ? {
          id: 'bio',
          node: (
            <BlockFrame title={t('bio')} tabLabel={t('professional')}>
              <Textarea
                value={bioDraft}
                onChange={(event) => setBioDraft(event.target.value)}
                rows={3}
              />
              <BlockActions
                busy={busyId === 'bio'}
                saveDisabled={!bioDraft.trim()}
                onDismiss={() => void run('bio', () => onDismiss('bio'))}
                onSave={() => void run('bio', () => onSave({ bio: bioDraft.trim() }))}
              />
            </BlockFrame>
          ),
        }
      : null,
    !textOf(user.organization)
      ? {
          id: 'organization',
          node: (
            <BlockFrame title={t('organization')} tabLabel={t('professional')}>
              <OrganizationEntitySelect value="" onSaved={() => undefined} />
              <BlockActions
                showSave={false}
                busy={busyId === 'organization'}
                onDismiss={() => void run('organization', () => onDismiss('organization'))}
              />
            </BlockFrame>
          ),
        }
      : null,
    !textOf(user.position)
      ? {
          id: 'position',
          node: (
            <BlockFrame title={t('position')} tabLabel={t('professional')}>
              <PositionTagCloud value="" onSaved={() => undefined} />
              <BlockActions
                showSave={false}
                busy={busyId === 'position'}
                onDismiss={() => void run('position', () => onDismiss('position'))}
              />
            </BlockFrame>
          ),
        }
      : null,
    !user.skills?.length
      ? {
          id: 'skills',
          node: (
            <BlockFrame title={t('skillsExpertise')} tabLabel={t('professional')}>
              <SkillsTagCloud value={[]} onSaved={() => undefined} />
              <BlockActions
                showSave={false}
                busy={busyId === 'skills'}
                onDismiss={() => void run('skills', () => onDismiss('skills'))}
              />
            </BlockFrame>
          ),
        }
      : null,
    !textOf(user.cultural?.country)
      ? {
          id: 'country',
          node: (
            <BlockFrame title={t('country')} tabLabel={t('regional')}>
              <Button type="button" size="sm" variant="outline" onClick={onOpenLocation}>
                {t('selectLocation')}
              </Button>
              <BlockActions
                showSave={false}
                busy={busyId === 'country'}
                onDismiss={() => void run('country', () => onDismiss('country'))}
              />
            </BlockFrame>
          ),
        }
      : null,
    !textOf(user.cultural?.timezone)
      ? {
          id: 'timezone',
          node: (
            <BlockFrame title={t('timezone')} tabLabel={t('regional')}>
              <Button type="button" size="sm" variant="outline" onClick={onOpenTimezone}>
                {t('selectTimezone')}
              </Button>
              <BlockActions
                showSave={false}
                busy={busyId === 'timezone'}
                onDismiss={() => void run('timezone', () => onDismiss('timezone'))}
              />
            </BlockFrame>
          ),
        }
      : null,
    cityHasDistricts && !textOf(user.cultural?.district)
      ? {
          id: 'district',
          node: (
            <BlockFrame title={t('district')} tabLabel={t('regional')}>
              <DistrictSelect value={districtDraft} onChange={setDistrictDraft} />
              <BlockActions
                busy={busyId === 'district'}
                saveDisabled={!districtDraft.trim()}
                onDismiss={() => void run('district', () => onDismiss('district'))}
                onSave={() =>
                  void run('district', () =>
                    onSave({ cultural: { district: districtDraft.trim() } }),
                  )
                }
              />
            </BlockFrame>
          ),
        }
      : null,
  ]

  const visible = blocks.filter((block): block is { id: string; node: React.ReactNode } => {
    if (!block) return false
    return !dismissed.has(block.id)
  })

  if (visible.length === 0) return null

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">{t('unfilledTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('unfilledHint')}</p>
      </div>
      {visible.map((block) => (
        <div key={block.id}>{block.node}</div>
      ))}
    </div>
  )
}
