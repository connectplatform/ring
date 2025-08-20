'use client'

import React from 'react'
import { useSession } from '@/components/providers/session-provider'
import authClient from '@/lib/auth-client'
import { motion, AnimatePresence, Variants } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import { Wallet } from '@/features/auth/types'
import { formatAddress } from '@/features/wallet/utils'

/**
 * @interface WalletConnectPopupProps
 * @property {boolean} isOpen - Determines if the popup is visible
 * @property {() => Promise<void>} onCloseAction - Function to call when closing the popup
 */
interface WalletConnectPopupProps {
  isOpen: boolean
  onCloseAction: () => Promise<void>
}

/**
 * WalletConnectPopup Component
 * 
 * This component renders a popup for connecting a wallet or signing in with Google.
 * It displays the user's wallet address and MATIC balance if available.
 * 
 * User steps:
 * 1. User triggers the popup to open (handled by parent component)
 * 2. User sees the popup with options to connect wallet or sign in with Google
 * 3. User can choose to sign in with Google
 * 4. If signed in, user sees their wallet address and MATIC balance
 * 5. User can close the popup
 * 
 * @param {WalletConnectPopupProps} props - The component props
 * @returns {JSX.Element} The rendered WalletConnectPopup component
 */
export const WalletConnectPopup: React.FC<WalletConnectPopupProps> = ({ isOpen, onCloseAction }) => {
  const t = useTranslations('modules.wallet')
  const { data: session } = useSession()

  /**
   * Handles the Google sign-in process
   */
  const handleGoogleSignIn = async () => {
    try {
      await authClient.signIn.social({ provider: 'google' })
    } catch (error) {
      console.error('Error signing in with Google:', error)
    }
  }

  /**
   * Gets the default wallet from the user's wallets array
   * @returns {Wallet | undefined} The default wallet or undefined if not found
   */
  const getDefaultWallet = (): Wallet | undefined => {
    const wallets = session?.user?.wallets
    if (!wallets || wallets.length === 0) return undefined
    const { selectDefaultWallet } = require('@/services/wallet/utils')
    return selectDefaultWallet(wallets) || undefined
  }

  // Get the default wallet
  const defaultWallet = getDefaultWallet()

  // Animation variants for the popup container
  const containerVariants: Variants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: {
        duration: 0.3,
        ease: 'easeOut',
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.8,
      transition: {
        duration: 0.2,
        ease: 'easeIn'
      }
    }
  }

  // Animation variants for the popup content items
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
        >
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full"
          >
            <motion.h2
              variants={itemVariants}
              className="text-2xl font-bold mb-4 text-gray-900 dark:text-white"
            >
              {t('connectWallet')}
            </motion.h2>
            <motion.div variants={itemVariants}>
              <Button 
                onClick={handleGoogleSignIn} 
                className="w-full mb-4 bg-secondary text-secondary-foreground"
              >
                {t('signInWithGoogle')}
              </Button>
            </motion.div>
            {defaultWallet && (
              <motion.div variants={itemVariants} className="mb-4 text-gray-700 dark:text-gray-300">
                <p>{t('walletAddress')}: {formatAddress(defaultWallet.address)}</p>
                <p>{t('maticBalance')}: {defaultWallet.balance} MATIC</p>
              </motion.div>
            )}
            <motion.div variants={itemVariants}>
              <Button 
                onClick={onCloseAction}
                className="w-full bg-gray-300 text-gray-800 dark:bg-gray-600 dark:text-white"
              >
                {t('close')}
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default WalletConnectPopup
