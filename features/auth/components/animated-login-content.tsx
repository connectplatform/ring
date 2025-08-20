'use client'

import { motion, Variants, AnimatePresence } from 'framer-motion'
import React from 'react'

export const containerVariants: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, when: 'beforeChildren', staggerChildren: 0.1 }
  },
  exit: { opacity: 0, y: 20 }
}

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 }
}

export function AnimatedLoginContainer({ children }: { children: React.ReactNode }) {
  return (
    <AnimatePresence>
      <motion.div variants={containerVariants} initial="hidden" animate="visible" exit="exit">
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

export function AnimatedItem({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <motion.div variants={itemVariants} style={style}>
      {children}
    </motion.div>
  )
}


