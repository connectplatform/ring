'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import React from 'react'

/**
 * Props for the SlidingPopup component
 * @interface SlidingPopupProps
 * @property {boolean} isOpen - Determines if the popup is open or closed
 * @property {() => Promise<void>} onCloseAction - Function to call when closing the popup
 * @property {React.ReactNode} children - Content to render inside the popup
 */
interface SlidingPopupProps {
  isOpen: boolean
  onCloseAction: () => Promise<void>
  children: React.ReactNode
}

/**
 * SlidingPopup component
 * Renders a sliding popup modal with animation
 * 
 * User steps:
 * 1. The popup is triggered to open (isOpen becomes true)
 * 2. The popup slides up from the bottom of the screen
 * 3. User can interact with the content inside the popup
 * 4. User can close the popup by clicking outside or on the close button
 * 5. The popup slides down and disappears
 * 
 * @param {SlidingPopupProps} props - The props for the SlidingPopup component
 * @returns {JSX.Element | null} The rendered SlidingPopup component or null if not open
 */
export function SlidingPopup({ isOpen, onCloseAction, children }: SlidingPopupProps) {
  /**
   * Handles the click event on the popup content
   * Stops the event propagation to prevent closing when clicking inside the popup
   * @param {React.MouseEvent<HTMLElement>} e - The click event
   */
  const handleContentClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation()
  }

  /**
   * Handles the close action
   * Wraps the onCloseAction in a try-catch block for error handling
   */
  const handleClose = async () => {
    try {
      await onCloseAction()
    } catch (error) {
      console.error('Error closing popup:', error)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 500 }}
            className="bg-background dark:bg-gray-800 w-full sm:w-3/4 md:w-2/3 lg:w-1/2 h-3/4 sm:h-auto sm:max-h-[80vh] rounded-t-xl sm:rounded-xl p-6 overflow-auto shadow-lg"
            onClick={handleContentClick}
          >
            <div className="relative">
              <Button
                onClick={handleClose}
                className="absolute top-0 right-0 text-2xl"
                variant="ghost"
                size="icon"
                aria-label="Close popup"
              >
                &times;
              </Button>
              <div className="mt-8 sm:mt-0">
                {children}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default SlidingPopup