'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

/**
 * Props for the AnimatedNotFound component
 * @interface AnimatedNotFoundProps
 * @property {string} title - The title to display on the not found page
 * @property {string} message - The message to display below the title
 * @property {string} linkText - The text to display on the link back to the home page
 */
interface AnimatedNotFoundProps {
  title: string
  message: string
  linkText: string
}

/**
 * AnimatedNotFound component
 * Displays a customizable 404 Not Found page with animations
 * 
 * User steps:
 * 1. User navigates to a non-existent page or encounters a 404 error
 * 2. The AnimatedNotFound component is rendered with custom title, message, and link text
 * 3. User sees an animated display of the error information
 * 4. User can click on the provided link to navigate back to the home page
 * 
 * @param {AnimatedNotFoundProps} props - The props for the AnimatedNotFound component
 * @returns {React.ReactElement} The rendered AnimatedNotFound component
 */
const AnimatedNotFound: React.FC<AnimatedNotFoundProps> = ({ title, message, linkText }) => {
  // Animation variants for the content
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        delay: 0.2,
        when: "beforeChildren",
        staggerChildren: 0.2
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  return (
    <motion.div 
      className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.h1 
        className="text-4xl font-bold mb-4"
        variants={itemVariants}
      >
        {title}
      </motion.h1>
      <motion.p 
        className="text-xl mb-8 text-muted-foreground"
        variants={itemVariants}
      >
        {message}
      </motion.p>
      <motion.div variants={itemVariants}>
        <Link 
          href="/" 
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-4 rounded transition-colors duration-200"
        >
          {linkText}
        </Link>
      </motion.div>
    </motion.div>
  )
}

export default AnimatedNotFound

