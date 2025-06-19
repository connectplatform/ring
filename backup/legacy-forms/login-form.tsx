'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, Variants, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/node_modules/react-i18next'
import { ROUTES } from '@/constants/routes'
import { AiFillApple } from 'react-icons/ai'
import { FaEthereum } from 'react-icons/fa'
import { FcGoogle } from 'react-icons/fc'
import { signIn, useSession } from 'next-auth/react'
import { ethers } from 'ethers'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle } from '@/components/ui/alert'

// Client-side constant for default locale
const DEFAULT_LOCALE = 'en' as const

interface LoginFormProps {
  from?: string;
}

const LoginForm: React.FC<LoginFormProps> = ({ from }) => {
  const { t } = useTranslation()
  const router = useRouter()
  const { data: session, status } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(from || ROUTES.PROFILE(DEFAULT_LOCALE))
    }
  }, [status, router, from])

  if (status === 'loading') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%'
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1 }}
        >
          Loading...
        </motion.div>
      </motion.div>
    )
  }

  const handleSignInError = (error: Error) => {
    console.error('Error signing in:', error)
    setError(t('errorSigningIn'))
  }

  const handleSignIn = async (provider: string) => {
    setIsLoading(true)
    try {
      const result = await signIn(provider, { redirect: false, callbackUrl: from || ROUTES.PROFILE(DEFAULT_LOCALE) })
      if (result?.error) {
        throw new Error(result.error)
      }
      if (result?.url) {
        router.push(result.url)
      }
    } catch (error) {
      handleSignInError(error as Error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMetaMaskSignIn = async () => {
    setIsLoading(true)
    try {
      if (typeof window !== 'undefined' && typeof (window as any).ethereum !== 'undefined') {
        const provider = new ethers.BrowserProvider((window as any).ethereum)
        await provider.send("eth_requestAccounts", [])
        const signer = await provider.getSigner()
        const address = await signer.getAddress()
        
        console.log('Ethereum address:', address)
        router.push(from || ROUTES.PROFILE(DEFAULT_LOCALE))
      } else {
        throw new Error('MetaMask is not installed')
      }
    } catch (error) {
      handleSignInError(error as Error)
    } finally {
      setIsLoading(false)
    }
  }

  const containerVariants: Variants = {
    hidden: { opacity: 0, y: -20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.5,
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    },
    exit: { opacity: 0, y: 20 }
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: -10 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 }
  }

  return (
    <AnimatePresence>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        style={{
          width: '100%',
          maxWidth: '24rem',
          padding: '2rem',
          backgroundColor: 'var(--card-background)',
          color: 'var(--card-foreground)',
          borderRadius: '0.5rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <motion.h1
          variants={itemVariants}
          style={{
            fontSize: '1.875rem',
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: '2rem'
          }}
        >
          {t('login')}
        </motion.h1>
        <motion.div
          variants={itemVariants}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}
        >
          <Button
            onClick={() => handleSignIn('google')}
            disabled={isLoading}
            variant="outline"
            style={{
              width: '100%',
              height: '3rem',
              fontSize: '1rem',
              fontWeight: '500'
            }}
          >
            <FcGoogle style={{ marginRight: '0.5rem', height: '1.25rem', width: '1.25rem' }} />
            {t('signInWithGoogle')}
          </Button>
          <Button
            onClick={() => handleSignIn('apple')}
            disabled={isLoading}
            variant="outline"
            style={{
              width: '100%',
              height: '3rem',
              fontSize: '1rem',
              fontWeight: '500'
            }}
          >
            <AiFillApple style={{ marginRight: '0.5rem', height: '1.25rem', width: '1.25rem' }} />
            {t('signInWithApple')}
          </Button>
          <Button
            onClick={handleMetaMaskSignIn}
            disabled={isLoading}
            variant="outline"
            style={{
              width: '100%',
              height: '3rem',
              fontSize: '1rem',
              fontWeight: '500'
            }}
          >
            <FaEthereum style={{ marginRight: '0.5rem', height: '1.25rem', width: '1.25rem' }} />
            {t('signInWithMetaMask')}
          </Button>
        </motion.div>
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.3 }}
              style={{ marginTop: '1.5rem' }}
            >
              <Alert variant="destructive">
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}

export default LoginForm

