/**
 * Ring Widgets Contact Component
 *
 * Displays a contact card with name, avatar, social links, and custom links.
 * Used to display full contact info on articles and pages.
 *
 * @author LegioX Commander
 * @version 1.0.0
 *
 * Logic and functional flow are explained inline.
 */

'use client'

import { memo, useMemo, type ComponentProps } from 'react'
import { useLocale } from 'next-intl'
import {
  ExternalLink,
  MessageCircle,
  Phone,
  User,
} from 'lucide-react'
import { FacebookIcon } from '@/components/ui/icons/facebook-icon'
import { TwitterIcon } from '@/components/ui/icons/twitter-icon'
import { LinkedinIcon } from '@/components/ui/icons/linkedin-icon'
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
  key: string               // Unique key for each type of link (e.g., 'linkedin', 'facebook')
  label: string             // User/Platform label
  href: string              // URL to the social profile/external site/internal profile
  external: boolean         // Determines anchor vs. client link
}

/**
 * Helper to determine display name, preferring full name, then fallback values.
 */
function displayName(props: RingWidgetsContactProps): string {
  const parts = [props.firstName, props.lastName].filter(Boolean)
  if (parts.length > 0) return parts.join(' ')
  if (props.nickname) return props.nickname
  if (props.projectUsername) return `@${props.projectUsername}`
  return 'Contact'
}

/**
 * Helper to generate initials from display name.
 */
function initials(props: RingWidgetsContactProps): string {
  // Split the display name by whitespace, take first chars, combine and uppercase.
  const name = displayName(props)
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/**
 * Main display component for contact widget.
 * - Validates and parses props with schema.
 * - Computes social link objects.
 * - Renders card header with avatar and name.
 * - Renders a button group for each link and social.
 */
function RingWidgetsContactInner(props: RingWidgetsContactProps) {
  // Get current locale (from next-intl).
  const locale = useLocale() as Locale
  // Validate/parse props according to schema using zod.
  const contact = useMemo(() => ringWidgetsContactSchema.parse(props), [props])

  /**
   * Build all available social and custom links for render.
   * Each possible field is conditionally added if defined on the contact.
   */
  // TODO: Consider extraction to useMemo with stable keys if contact structure is stable.
  const socialLinks = useMemo(() => {
    const links: SocialLink[] = []
    // "X" (Twitter/X)
    if (contact.xUsername) {
      links.push({
        key: 'x',
        label: 'X',
        href: buildSocialProfileUrl('x', contact.xUsername),
        external: true,
      })
    }
    // LinkedIn
    if (contact.linkedInUsername) {
      links.push({
        key: 'linkedin',
        label: 'LinkedIn',
        href: buildSocialProfileUrl('linkedIn', contact.linkedInUsername),
        external: true,
      })
    }
    // Facebook
    if (contact.facebookUsername) {
      links.push({
        key: 'facebook',
        label: 'Facebook',
        href: buildSocialProfileUrl('facebook', contact.facebookUsername),
        external: true,
      })
    }
    // Instagram (NOTE: Actually using TwitterIcon here.
    // TODO: Update to Instagram icon. TwitterIcon should import from @components/ui/icons/twitter-icon
    if (contact.instagramUsername) {
      links.push({
        key: 'instagram',
        label: 'Instagram',
        href: buildSocialProfileUrl('instagram', contact.instagramUsername),
        external: true,
      })
    }
    // Telegram
    if (contact.telegramUsername) {
      links.push({
        key: 'telegram',
        label: 'Telegram',
        href: buildSocialProfileUrl('telegram', contact.telegramUsername),
        external: true,
      })
    }
    // WhatsApp
    if (contact.whatsAppBusinessNumber) {
      links.push({
        key: 'whatsapp',
        label: 'WhatsApp',
        href: buildSocialProfileUrl('whatsApp', contact.whatsAppBusinessNumber),
        external: true,
      })
    }
    // Internal Ring profile
    if (contact.projectUsername) {
      links.push({
        key: 'project',
        label: 'Ring profile',
        href: buildSocialProfileUrl('project', contact.projectUsername, locale),
        external: false,
      })
    }
    // Add any user-custom links, marked as external.
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

  // Human-friendly display name to show in card
  const name = displayName(contact)

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      {/* Card header displays avatar and identity */}
      <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-4">
        <Avatar
          src={contact.photoAvatar}
          alt={name}
          size="lg"
          fallback={initials(contact)} // Shows initials if no photo
          className="border border-border shrink-0"
        />
        <div className="min-w-0 flex-1">
          <CardTitle className="text-xl truncate">{name}</CardTitle>
          {/* Show nickname (if present) as muted tag */}
          {contact.nickname ? (
            <p className="text-sm text-muted-foreground truncate">@{contact.nickname.replace(/^@/, '')}</p>
          ) : null}
          {/* Show badge if projectUsername is set */}
          {contact.projectUsername ? (
            <Badge variant="secondary" className="mt-2">
              <User className="h-3 w-3 mr-1" />
              {contact.projectUsername}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      {/* Render social and custom links if any */}
      {socialLinks.length > 0 ? (
        <CardContent className="space-y-4 pt-0">
          <div className="flex flex-wrap gap-2">
            {/* Render a button for each social or custom link */}
            {socialLinks.map((link) => {
              // Dynamically choose icon by link type.
              // TODO: Refactor to a map/object for icon selection for easier extension.
              const icon =
                link.key === 'x' ? (
                  <TwitterIcon className="h-4 w-4" />
                ) : link.key === 'linkedin' ? (
                  <LinkedinIcon className="h-4 w-4" />
                ) : link.key === 'facebook' ? (
                  <FacebookIcon className="h-4 w-4" />
                ) : link.key === 'instagram' ? (
                  <TwitterIcon className="h-4 w-4" /> // TODO: This is probably not correct for Instagram.
                ) : link.key === 'telegram' ? (
                  <MessageCircle className="h-4 w-4" />
                ) : link.key === 'whatsapp' ? (
                  <Phone className="h-4 w-4" />
                ) : link.key === 'project' ? (
                  <User className="h-4 w-4" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )

              // For external links, use <a>
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

              // For internal app routes, use <Link>
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
          {/* If customLinks have descriptions, render each below the button set */}
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

// TODO: Replace memo with React 19's improved Memo and Consider useOptimistic for progressive updates if needed.
export const RingWidgetsContact = memo(RingWidgetsContactInner)
RingWidgetsContact.displayName = 'RingWidgetsContact'
