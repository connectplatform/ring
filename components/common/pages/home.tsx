'use client'

import React from 'react'
import { motion, Variants } from 'framer-motion'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { Session } from 'next-auth'

/**
 * @interface HomeContentProps
 * @property {Session | null} session - The user's session information
 */
interface HomeContentProps {
  session: Session | null
}

/**
 * HomeContent Component
 * 
 * This component renders the main content of the home page, including welcome messages,
 * descriptions, and links to other parts of the application.
 * 
 * User steps:
 * 1. User arrives at the home page
 * 2. The component animates in the welcome message and description
 * 3. Two main navigation links (entities and opportunities) are displayed
 * 4. If the user is logged in, a personalized welcome message is shown
 * 
 * @param {HomeContentProps} props - The component props
 * @returns {JSX.Element} The rendered HomeContent component
 */
const HomeContent: React.FC<HomeContentProps> = ({ session }) => {
  const tCommon = useTranslations('common')
  const tPages = useTranslations('pages.home')
  const tConfig = useTranslations('config')
  const { theme, resolvedTheme } = useTheme()

  // Determine the current theme (dark or light)
  const currentTheme = theme === 'system' ? resolvedTheme : theme

  // Define animation variants for different elements
  const titleVariants: Variants = {
    hidden: { opacity: 0, y: -50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  }

  const subtitleVariants: Variants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.2 } }
  }

  const textVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5, delay: 0.4 } }
  }

  const linksVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5, delay: 0.6 } }
  }

  const sessionMessageVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5, delay: 0.8 } }
  }

  // Define styles for different elements
  const containerStyle: React.CSSProperties = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem 1rem',
    textAlign: 'center',
    position: 'relative',
    zIndex: 10
  }

  const titleStyle: React.CSSProperties = {
    fontSize: 'clamp(2rem, 5vw, 4rem)',
    fontWeight: 'bold',
    marginBottom: '1rem',
    // Replace gradient text with token-based color to avoid overlay/stripe artifacts
    color: 'hsl(var(--foreground))',
    transformOrigin: '50% 50%'
  }

  const subtitleStyle: React.CSSProperties = {
    ...titleStyle,
    color: 'hsl(var(--primary))',
    transformOrigin: '50% 50%'
  }

  const descriptionStyle: React.CSSProperties = {
    fontSize: 'clamp(1rem, 2vw, 1.25rem)',
    marginBottom: '2rem',
    maxWidth: '90vw',
    margin: '0 auto 2rem',
    color: 'var(--muted-foreground)'
  }

  const linksContainerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '1rem',
    maxWidth: '90vw',
    margin: '0 auto',
    padding: '0 1rem'
  }

  const linkStyle: React.CSSProperties = {
    padding: '1rem 2rem',
    borderRadius: '0.5rem',
    fontWeight: 600,
    fontSize: '1rem',
    color: 'var(--primary-foreground)',
    textDecoration: 'none',
    transition: 'background 0.3s ease'
  }

  const entitiesLinkStyle: React.CSSProperties = {
    ...linkStyle,
    background: currentTheme === 'dark'
      ? 'linear-gradient(to right, #2563EB, #16A34A)'
      : 'linear-gradient(to right, #3B82F6, #22C55E)'
  }

  const opportunitiesLinkStyle: React.CSSProperties = {
    ...linkStyle,
    background: currentTheme === 'dark'
      ? 'linear-gradient(to right, #16A34A, #CA8A04)'
      : 'linear-gradient(to right, #22C55E, #F59E0B)'
  }

  const sessionMessageStyle: React.CSSProperties = {
    marginTop: '2rem',
    fontSize: '1.125rem',
    color: 'var(--muted-foreground)'
  }

  return (
    <div style={containerStyle}>
      <motion.h1 
        style={titleStyle}
        variants={titleVariants}
        initial="hidden"
        animate="visible"
        className="motion-safe motion-element"
      >
        {tPages('hero.title', { platform: tConfig('platform.name') })}
      </motion.h1>
      <motion.h2 
        style={subtitleStyle}
        variants={subtitleVariants}
        initial="hidden"
        animate="visible"
        className="motion-safe motion-element"
      >
        {tPages('hero.subtitle')}
      </motion.h2>
      <motion.p 
        style={descriptionStyle}
        variants={textVariants}
        initial="hidden"
        animate="visible"
        className="motion-safe motion-element"
      >
        {tPages('hero.description')}
      </motion.p>
      <motion.div
        style={linksContainerStyle}
        variants={linksVariants}
        initial="hidden"
        animate="visible"
        className="motion-safe motion-element"
      >
        <Link href="/entities" style={entitiesLinkStyle}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{tPages('links.entities')}</h2>
          <p style={{ fontSize: '0.875rem' }}>{tPages('links.entitiesDescription')}</p>
        </Link>
        <Link href="/opportunities" style={opportunitiesLinkStyle}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{tPages('links.opportunities')}</h2>
          <p style={{ fontSize: '0.875rem' }}>{tPages('links.opportunitiesDescription')}</p>
        </Link>
      </motion.div>
      {session && (
        <motion.p
          style={sessionMessageStyle}
          variants={sessionMessageVariants}
          initial="hidden"
          animate="visible"
          className="motion-safe motion-element"
        >
          {tCommon('messages.welcome', { name: session.user?.name || 'User' })}
        </motion.p>
      )}
    </div>
  )
}

export default HomeContent

