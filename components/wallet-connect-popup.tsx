'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { signIn } from "next-auth/react"
import { motion } from 'framer-motion'
import { ethers } from 'ethers'
import { Button } from '@/components/ui/button'
import { Wallet } from '@/features/auth/types'
import { auth } from '@/auth'
import { useTranslation } from '@/node_modules/react-i18next'

/**
 * Props for the WalletConnectPopup component
 * @interface WalletConnectPopupProps
 * @property {boolean} isOpen - Determines if the popup is open or closed
 * @property {() => void} onCloseAction - Function to call when closing the popup
 */
interface WalletConnectPopupProps {
  isOpen: boolean
  onCloseAction: () => void
}

/**
 * WalletConnectPopup Component
 * 
 * This component displays a popup for connecting a wallet or viewing wallet information.
 * 
 * User steps:
 * 1. User sees the popup when isOpen is true
 * 2. If not authenticated, user can sign in with Google
 * 3. If authenticated, user sees their wallet address, label, creation date, and MATIC balance
 * 4. User can close the popup at any time
 * 
 * @param {WalletConnectPopupProps} props - The component props
 * @returns {React.ReactElement | null} The rendered component or null if not open
 */
export const WalletConnectPopup: React.FC<WalletConnectPopupProps> = ({ isOpen, onCloseAction }) => {
  const { t } = useTranslation()
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [maticBalance, setMaticBalance] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const session = auth()

  /**
   * Fetches the MATIC balance for a given wallet address
   * Using useCallback to stabilize the function reference for useEffect dependency
   * @param {string} walletAddress - The address of the wallet to check
   */
  const fetchMaticBalance = useCallback(async (walletAddress: string) => {
    try {
      const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com')
      const balance = await provider.getBalance(walletAddress)
      const formattedBalance = ethers.formatEther(balance)
      setMaticBalance(parseFloat(formattedBalance).toFixed(4))
      
      // Update the wallet object with the new balance
      setWallet(prevWallet => {
        if (prevWallet) {
          return { ...prevWallet, balance: formattedBalance }
        }
        return prevWallet
      })
    } catch (error) {
      console.error('Error fetching Matic balance:', error)
      setMaticBalance(t('error'))
    }
  }, [t])

  // Effect to fetch wallet data and MATIC balance when the popup opens and a session is available
  useEffect(() => {
    const fetchWalletData = async () => {
      if (isOpen && session) {
        const sessionData = await session
        if (sessionData?.user?.wallets && sessionData.user.wallets.length > 0) {
          const userWallet: Wallet = sessionData.user.wallets[0]
          setWallet(userWallet)
          fetchMaticBalance(userWallet.address)
        }
      }
    }
    fetchWalletData()
  }, [isOpen, session, fetchMaticBalance])

  /**
   * Initiates the Google sign-in process
   */
  const handleGoogleSignIn = () => {
    signIn('google')
  }

  // If the popup is not open, don't render anything
  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
    >
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{wallet ? t('walletConnected') : t('connectWallet')}</h2>
          <button onClick={onCloseAction} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {!wallet ? (
          <div>
            <p className="mb-4">{t('connectWalletDescription')}</p>
            <button
              onClick={handleGoogleSignIn}
              disabled={isConnecting}
              className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            >
              {isConnecting ? t('connecting') : t('connectWallet')}
            </button>
          </div>
        ) : (
          <div>
            <p><strong>{t('walletAddress')}:</strong> {wallet.address}</p>
            <p><strong>{t('maticBalance')}:</strong> {maticBalance ?? wallet.balance ?? t('loading')} MATIC</p>
            <button
              onClick={onCloseAction}
              className="w-full bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mt-4"
            >
              {t('disconnectWallet')}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default WalletConnectPopup

