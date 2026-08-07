import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

export type MagicLinkEmailProps = {
  loginUrl: string
  userName?: string
  appName?: string
  expiresInMinutes?: number
  purpose?: 'login' | 'verify' | 'reset'
}

export function MagicLinkEmail({
  loginUrl,
  userName,
  appName = 'Ring Platform',
  expiresInMinutes = 30,
  purpose = 'login',
}: MagicLinkEmailProps) {
  const preview =
    purpose === 'reset'
      ? `Reset your ${appName} password`
      : purpose === 'verify'
        ? `Verify your ${appName} email`
        : `Sign in to ${appName}`
  const cta =
    purpose === 'reset' ? 'Reset password' : purpose === 'verify' ? 'Verify email' : 'Sign in'

  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{appName}</Heading>
          <Text style={text}>
            {userName ? `Hi ${userName},` : 'Hi,'} click the button below to continue. This link
            expires in {expiresInMinutes} minutes.
          </Text>
          <Button href={loginUrl} style={button}>
            {cta}
          </Button>
          <Text style={muted}>
            If the button does not work, paste this URL into your browser:
          </Text>
          <Text style={muted}>{loginUrl}</Text>
          <Text style={muted}>If you did not request this, you can ignore this email.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default MagicLinkEmail

MagicLinkEmail.PreviewProps = {
  loginUrl: 'https://ring-platform.org/verify#token=example',
  userName: 'Alex',
  appName: 'Ring Platform',
  expiresInMinutes: 30,
  purpose: 'login',
} satisfies MagicLinkEmailProps

const main = { backgroundColor: '#f6f9fc', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = {
  backgroundColor: '#ffffff',
  margin: '40px auto',
  padding: '32px',
  borderRadius: '8px',
  maxWidth: '480px',
}
const h1 = { fontSize: '22px', color: '#0f172a', marginBottom: '16px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.5' }
const muted = { fontSize: '13px', color: '#64748b', lineHeight: '1.5', wordBreak: 'break-all' as const }
const button = {
  backgroundColor: '#16a34a',
  borderRadius: '6px',
  color: '#fff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: 600,
  padding: '12px 24px',
  textDecoration: 'none',
  margin: '20px 0',
}
