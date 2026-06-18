'use client'

import { memo, useMemo, type ComponentProps } from 'react'
import { useLocale } from 'next-intl'
import {
  ExternalLink,
  Facebook,
  Instagram,
  Linkedin,
  MessageCircle,
  Phone,
  User,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Link } from '@/i18n/routing'
import type { RingWidgetsContactProps } from '@/lib/ring-widgets/contact-schema'
import { ringWidgetsContactSchema } from '@/lib/ring-widgets/contact-schema'
import { buildSocialProfileUrl } from '@/lib/ring-widgets/social-urls'
import type { Locale } from '@/i18n/shared'

type AppHref = ComponentProps<typeof Link>['href']

type SocialLink = {
  key: string
  label: string
  href: string
  external: boolean
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function displayName(props: RingWidgetsContactProps): string {
  const parts = [props.firstName, props.lastName].filter(Boolean)
  if (parts.length > 0) return parts.join(' ')
  if (props.nickname) return props.nickname
  if (props.projectUsername) return `@${props.projectUsername}`
  return 'Contact'
}

function initials(props: RingWidgetsContactProps): string {
  const name = displayName(props)
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function RingWidgetsContactInner(props: RingWidgetsContactProps) {
  const locale = useLocale() as Locale
  const contact = useMemo(() => ringWidgetsContactSchema.parse(props), [props])

  const socialLinks = useMemo(() => {
    const links: SocialLink[] = []
    if (contact.xUsername) {
      links.push({
        key: 'x',
        label: 'X',
        href: buildSocialProfileUrl('x', contact.xUsername),
        external: true,
      })
    }
    if (contact.linkedInUsername) {
      links.push({
        key: 'linkedin',
        label: 'LinkedIn',
        href: buildSocialProfileUrl('linkedIn', contact.linkedInUsername),
        external: true,
      })
    }
    if (contact.facebookUsername) {
      links.push({
        key: 'facebook',
        label: 'Facebook',
        href: buildSocialProfileUrl('facebook', contact.facebookUsername),
        external: true,
      })
    }
    if (contact.instagramUsername) {
      links.push({
        key: 'instagram',
        label: 'Instagram',
        href: buildSocialProfileUrl('instagram', contact.instagramUsername),
        external: true,
      })
    }
    if (contact.telegramUsername) {
      links.push({
        key: 'telegram',
        label: 'Telegram',
        href: buildSocialProfileUrl('telegram', contact.telegramUsername),
        external: true,
      })
    }
    if (contact.whatsAppBusinessNumber) {
      links.push({
        key: 'whatsapp',
        label: 'WhatsApp',
        href: buildSocialProfileUrl('whatsApp', contact.whatsAppBusinessNumber),
        external: true,
      })
    }
    if (contact.projectUsername) {
      links.push({
        key: 'project',
        label: 'Ring profile',
        href: buildSocialProfileUrl('project', contact.projectUsername, locale),
        external: false,
      })
    }
    contact.customLinks?.forEach((link, index) => {
      links.push({
        key: `custom-${index}`,
        label: link.name,
        href: link.uri,
        external: true,
      })
    })
    return links
  }, [contact, locale])

  const name = displayName(contact)

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-4">
        <Avatar
          src={contact.photoAvatar}
          alt={name}
          size="lg"
          fallback={initials(contact)}
          className="border border-border shrink-0"
        />
        <div className="min-w-0 flex-1">
          <CardTitle className="text-xl truncate">{name}</CardTitle>
          {contact.nickname ? (
            <p className="text-sm text-muted-foreground truncate">@{contact.nickname.replace(/^@/, '')}</p>
          ) : null}
          {contact.projectUsername ? (
            <Badge variant="secondary" className="mt-2">
              <User className="h-3 w-3 mr-1" />
              {contact.projectUsername}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      {socialLinks.length > 0 ? (
        <CardContent className="space-y-4 pt-0">
          <div className="flex flex-wrap gap-2">
            {socialLinks.map((link) => {
              const icon =
                link.key === 'x' ? (
                  <XIcon className="h-4 w-4" />
                ) : link.key === 'linkedin' ? (
                  <Linkedin className="h-4 w-4" />
                ) : link.key === 'facebook' ? (
                  <Facebook className="h-4 w-4" />
                ) : link.key === 'instagram' ? (
                  <Instagram className="h-4 w-4" />
                ) : link.key === 'telegram' ? (
                  <MessageCircle className="h-4 w-4" />
                ) : link.key === 'whatsapp' ? (
                  <Phone className="h-4 w-4" />
                ) : link.key === 'project' ? (
                  <User className="h-4 w-4" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )

              if (link.external) {
                return (
                  <Button key={link.key} variant="outline" size="sm" asChild>
                    <a href={link.href} target="_blank" rel="noopener noreferrer">
                      {icon}
                      <span className="ml-2">{link.label}</span>
                    </a>
                  </Button>
                )
              }

              return (
                <Button key={link.key} variant="outline" size="sm" asChild>
                  <Link href={link.href as AppHref}>
                    {icon}
                    <span className="ml-2">{link.label}</span>
                  </Link>
                </Button>
              )
            })}
          </div>
          {contact.customLinks?.map((link) =>
            link.desc ? (
              <p key={link.uri} className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3">
                <span className="font-medium text-foreground">{link.name}: </span>
                {link.desc}
              </p>
            ) : null,
          )}
        </CardContent>
      ) : null}
    </Card>
  )
}

export const RingWidgetsContact = memo(RingWidgetsContactInner)
RingWidgetsContact.displayName = 'RingWidgetsContact'
