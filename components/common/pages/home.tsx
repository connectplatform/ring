'use client'

import React, { useState, useEffect } from 'react'
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
  const [mounted, setMounted] = useState(false)
  const [currentFeature, setCurrentFeature] = useState(0)
  const [displayText, setDisplayText] = useState('')
  const [isTyping, setIsTyping] = useState(true)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Self-typing animation effect
  useEffect(() => {
    if (!mounted) return

    const features = tPages.raw('hero.features') as string[]
    const currentFeatureText = features[currentFeature]

    if (isTyping) {
      // Typing effect
      if (displayText.length < currentFeatureText.length) {
        const timeout = setTimeout(() => {
          setDisplayText(currentFeatureText.slice(0, displayText.length + 1))
        }, 50) // Typing speed
        return () => clearTimeout(timeout)
      } else {
        // Finished typing, wait before deleting
        const timeout = setTimeout(() => {
          setIsTyping(false)
        }, 2000) // Pause before deleting
        return () => clearTimeout(timeout)
      }
    } else {
      // Deleting effect
      if (displayText.length > 0) {
        const timeout = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1))
        }, 30) // Deleting speed
        return () => clearTimeout(timeout)
      } else {
        // Finished deleting, move to next feature
        setCurrentFeature((prev) => (prev + 1) % features.length)
        setIsTyping(true)
      }
    }
  }, [displayText, isTyping, currentFeature, mounted, tPages])

  // Determine the current theme (dark or light)
  const currentTheme = theme === 'system' ? resolvedTheme : theme

  // Add blinking cursor animation
  const cursorKeyframes = `
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
  `

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
    fontSize: 'clamp(1.75rem, 4vw, 3rem)',
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
    <>
      <style dangerouslySetInnerHTML={{ __html: cursorKeyframes }} />
      <div style={containerStyle}>
      {/* Hero content - Visible on all screen sizes */}
      <div>
        <motion.h1
          style={titleStyle}
          variants={mounted ? titleVariants : undefined}
          initial={mounted ? "hidden" : false}
          animate={mounted ? "visible" : false}
          className="motion-safe motion-element"
        >
          {tPages('hero.title')}
        </motion.h1>

        {/* Subtitle */}
        <motion.div
          style={{
            ...subtitleStyle,
            fontSize: 'clamp(1.1rem, 2vw, 1.5rem)',
            marginBottom: '1.5rem',
            fontWeight: '600'
          }}
          variants={mounted ? subtitleVariants : undefined}
          initial={mounted ? "hidden" : false}
          animate={mounted ? "visible" : false}
          className="motion-safe motion-element"
        >
          {tPages('hero.subtitle')}
        </motion.div>

        {/* Trinity Ukraine origin story */}
        <motion.div
          style={{
            fontSize: 'clamp(0.9rem, 1.8vw, 1.1rem)',
            marginBottom: '2rem',
            color: 'hsl(var(--primary))',
            fontWeight: '500',
            textAlign: 'center'
          }}
          variants={mounted ? textVariants : undefined}
          initial={mounted ? "hidden" : false}
          animate={mounted ? "visible" : false}
          className="motion-safe motion-element"
        >
          {tPages('hero.trinityUkraine')}
        </motion.div>

      {/* Self-typing features animation */}
      <motion.div
        style={{
          ...subtitleStyle,
          fontSize: 'clamp(1rem, 2vw, 1.4rem)',
          minHeight: '3rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '2rem'
        }}
        variants={mounted ? subtitleVariants : undefined}
        initial={mounted ? "hidden" : false}
        animate={mounted ? "visible" : false}
        className="motion-safe motion-element"
      >
        <span style={{ color: 'hsl(var(--primary))' }}>
          {displayText}
          <span
            style={{
              opacity: isTyping ? 1 : 0,
              animation: isTyping ? 'blink 1s infinite' : 'none'
            }}
          >
            |
          </span>
        </span>
      </motion.div>

      {/* Git clone instruction */}
      <motion.div
        style={{
          ...descriptionStyle,
          textAlign: 'center',
          marginTop: '2rem'
        }}
        variants={mounted ? textVariants : undefined}
        initial={mounted ? "hidden" : false}
        animate={mounted ? "visible" : false}
        className="motion-safe motion-element"
      >
        <div style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: '500' }}>
          {tPages('hero.gitCloneText')}
        </div>
        <div style={{ position: 'relative', display: 'inline-block', width: '100%', maxWidth: '600px' }}>
          <div
            style={{
              background: 'hsl(var(--muted))',
              padding: '1rem',
              borderRadius: '0.5rem',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              color: 'hsl(var(--foreground))',
              border: '1px solid hsl(var(--border))',
              paddingRight: '3rem'
            }}
          >
            {tPages('hero.gitClone')}
          </div>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(tPages('hero.gitClone'))
                // Simple feedback - you could enhance this with a toast
                alert('Copied to clipboard!')
              } catch (err) {
                console.error('Failed to copy:', err)
              }
            }}
            style={{
              position: 'absolute',
              right: '0.5rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              border: 'none',
              borderRadius: '0.25rem',
              padding: '0.25rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Copy to clipboard"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
          </button>
        </div>
      </motion.div>
      </div>

      {/* Get Started Section */}
      <motion.div
        style={{
          ...linksContainerStyle,
          marginTop: '2rem'
        }}
        variants={mounted ? linksVariants : undefined}
        initial={mounted ? "hidden" : false}
        animate={mounted ? "visible" : false}
        className="motion-safe motion-element"
      >
        <div style={{ width: '100%', textAlign: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'hsl(var(--foreground))', marginBottom: '1rem' }}>
            Get Started
          </h3>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '0.75rem',
          width: '100%',
          maxWidth: '500px',
          margin: '0 auto'
        }}>
          <Link
            href={`/${session ? '' : ''}docs/getting-started`}
            style={{
              ...linkStyle,
              background: currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)'
                : 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
              border: '1px solid',
              borderColor: currentTheme === 'dark'
                ? 'rgba(34, 197, 94, 0.2)'
                : 'rgba(34, 197, 94, 0.3)',
              borderRadius: '12px',
              padding: '1.25rem',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              color: 'hsl(var(--foreground))',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: currentTheme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)'
                : 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(59, 130, 246, 0.12) 100%)'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = currentTheme === 'dark' 
                ? '0 8px 24px rgba(34, 197, 94, 0.15)'
                : '0 8px 24px rgba(0,0,0,0.1)'
              e.currentTarget.style.borderColor = currentTheme === 'dark'
                ? 'rgba(34, 197, 94, 0.4)'
                : 'rgba(34, 197, 94, 0.5)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)'
                : 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = currentTheme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
              e.currentTarget.style.borderColor = currentTheme === 'dark'
                ? 'rgba(34, 197, 94, 0.2)'
                : 'rgba(34, 197, 94, 0.3)'
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgb(34, 197, 94) 0%, rgb(59, 130, 246) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0
            }}>📦</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem', color: 'hsl(var(--foreground))' }}>Clone Ring Now</div>
              <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', lineHeight: '1.4' }}>Free forever, no vendor lock-in</div>
            </div>
          </Link>
          <Link
            href={`/${session ? '' : ''}opportunities?type=ring_customization`}
            style={{
              ...linkStyle,
              background: currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(245, 158, 11, 0.05) 100%)'
                : 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(245, 158, 11, 0.08) 100%)',
              border: '1px solid',
              borderColor: currentTheme === 'dark'
                ? 'rgba(16, 185, 129, 0.2)'
                : 'rgba(16, 185, 129, 0.3)',
              borderRadius: '12px',
              padding: '1.25rem',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              color: 'hsl(var(--foreground))',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: currentTheme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%)'
                : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(245, 158, 11, 0.12) 100%)'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = currentTheme === 'dark' 
                ? '0 8px 24px rgba(16, 185, 129, 0.15)'
                : '0 8px 24px rgba(0,0,0,0.1)'
              e.currentTarget.style.borderColor = currentTheme === 'dark'
                ? 'rgba(16, 185, 129, 0.4)'
                : 'rgba(16, 185, 129, 0.5)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(245, 158, 11, 0.05) 100%)'
                : 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(245, 158, 11, 0.08) 100%)'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = currentTheme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
              e.currentTarget.style.borderColor = currentTheme === 'dark'
                ? 'rgba(16, 185, 129, 0.2)'
                : 'rgba(16, 185, 129, 0.3)'
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgb(16, 185, 129) 0%, rgb(245, 158, 11) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0
            }}>🔧</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem', color: 'hsl(var(--foreground))' }}>Browse Customization Projects</div>
              <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', lineHeight: '1.4' }}>Find Ring development opportunities</div>
            </div>
          </Link>
          <Link
            href={`/${session ? '' : ''}tools/deployment-calculator`}
            style={{
              ...linkStyle,
              background: currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(239, 68, 68, 0.05) 100%)'
                : 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(239, 68, 68, 0.08) 100%)',
              border: '1px solid',
              borderColor: currentTheme === 'dark'
                ? 'rgba(245, 158, 11, 0.2)'
                : 'rgba(245, 158, 11, 0.3)',
              borderRadius: '12px',
              padding: '1.25rem',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              color: 'hsl(var(--foreground))',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: currentTheme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(239, 68, 68, 0.1) 100%)'
                : 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(239, 68, 68, 0.12) 100%)'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = currentTheme === 'dark' 
                ? '0 8px 24px rgba(245, 158, 11, 0.15)'
                : '0 8px 24px rgba(0,0,0,0.1)'
              e.currentTarget.style.borderColor = currentTheme === 'dark'
                ? 'rgba(245, 158, 11, 0.4)'
                : 'rgba(245, 158, 11, 0.5)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(239, 68, 68, 0.05) 100%)'
                : 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(239, 68, 68, 0.08) 100%)'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = currentTheme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
              e.currentTarget.style.borderColor = currentTheme === 'dark'
                ? 'rgba(245, 158, 11, 0.2)'
                : 'rgba(245, 158, 11, 0.3)'
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgb(245, 158, 11) 0%, rgb(239, 68, 68) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0
            }}>🧮</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem', color: 'hsl(var(--foreground))' }}>Calculate Deployment Cost</div>
              <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', lineHeight: '1.4' }}>Estimate your Ring setup</div>
            </div>
          </Link>
          <Link
            href={`/${session ? '' : ''}wallet/topup`}
            style={{
              ...linkStyle,
              background: currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(236, 72, 153, 0.05) 100%)'
                : 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(236, 72, 153, 0.08) 100%)',
              border: '1px solid',
              borderColor: currentTheme === 'dark'
                ? 'rgba(168, 85, 247, 0.2)'
                : 'rgba(168, 85, 247, 0.3)',
              borderRadius: '12px',
              padding: '1.25rem',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              color: 'hsl(var(--foreground))',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: currentTheme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)'
                : 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(236, 72, 153, 0.12) 100%)'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = currentTheme === 'dark' 
                ? '0 8px 24px rgba(168, 85, 247, 0.15)'
                : '0 8px 24px rgba(0,0,0,0.1)'
              e.currentTarget.style.borderColor = currentTheme === 'dark'
                ? 'rgba(168, 85, 247, 0.4)'
                : 'rgba(168, 85, 247, 0.5)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(236, 72, 153, 0.05) 100%)'
                : 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(236, 72, 153, 0.08) 100%)'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = currentTheme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
              e.currentTarget.style.borderColor = currentTheme === 'dark'
                ? 'rgba(168, 85, 247, 0.2)'
                : 'rgba(168, 85, 247, 0.3)'
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgb(168, 85, 247) 0%, rgb(236, 72, 153) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0
            }}>💎</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem', color: 'hsl(var(--foreground))' }}>Buy RING Tokens</div>
              <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', lineHeight: '1.4' }}>Power your platform economy</div>
            </div>
          </Link>
          <Link
            href={`/${session ? '' : ''}about-trinity`}
            style={{
              ...linkStyle,
              background: currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(147, 51, 234, 0.05) 100%)'
                : 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 51, 234, 0.08) 100%)',
              border: '1px solid',
              borderColor: currentTheme === 'dark'
                ? 'rgba(59, 130, 246, 0.2)'
                : 'rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              padding: '1.25rem',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              color: 'hsl(var(--foreground))',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: currentTheme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)'
                : 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(147, 51, 234, 0.12) 100%)'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = currentTheme === 'dark' 
                ? '0 8px 24px rgba(59, 130, 246, 0.15)'
                : '0 8px 24px rgba(0,0,0,0.1)'
              e.currentTarget.style.borderColor = currentTheme === 'dark'
                ? 'rgba(59, 130, 246, 0.4)'
                : 'rgba(59, 130, 246, 0.5)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(147, 51, 234, 0.05) 100%)'
                : 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 51, 234, 0.08) 100%)'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = currentTheme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
              e.currentTarget.style.borderColor = currentTheme === 'dark'
                ? 'rgba(59, 130, 246, 0.2)'
                : 'rgba(59, 130, 246, 0.3)'
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(147, 51, 234) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0
            }}>🇺🇦</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem', color: 'hsl(var(--foreground))' }}>Read Our Story</div>
              <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', lineHeight: '1.4' }}>Trinity Ukraine's gift to the world</div>
            </div>
          </Link>
        </div>
      </motion.div>
      {session && (
        <motion.p
          style={sessionMessageStyle}
          variants={mounted ? sessionMessageVariants : undefined}
          initial={mounted ? "hidden" : false}
          animate={mounted ? "visible" : false}
          className="motion-safe motion-element"
        >
          {tCommon('messages.welcome', { name: session.user?.name || 'User' })}
        </motion.p>
      )}
      </div>
    </>
  )
}

export default HomeContent



