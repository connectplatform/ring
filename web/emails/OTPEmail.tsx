import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export type OTPEmailProps = {
  code: string
  userName?: string
  appName?: string
  expiresInMinutes?: number
}

export function OTPEmail({
  code,
  userName,
  appName = 'Ring Platform',
  expiresInMinutes = 10,
}: OTPEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{`Your ${appName} sign-in code: ${code}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{appName}</Heading>
          <Text style={text}>
            {userName ? `Hi ${userName},` : 'Hi,'} use this one-time code to sign in:
          </Text>
          <Section style={codeBox}>
            <Text style={codeText}>{code}</Text>
          </Section>
          <Text style={text}>
            This code expires in {expiresInMinutes} minutes. If you did not request it, ignore
            this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default OTPEmail

OTPEmail.PreviewProps = {
  code: '482193',
  userName: 'Alex',
  appName: 'Ring Platform',
  expiresInMinutes: 10,
} satisfies OTPEmailProps

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
const codeBox = {
  backgroundColor: '#f1f5f9',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 0',
  textAlign: 'center' as const,
}
const codeText = {
  fontSize: '32px',
  letterSpacing: '8px',
  fontWeight: 700,
  color: '#0f172a',
  margin: 0,
}
