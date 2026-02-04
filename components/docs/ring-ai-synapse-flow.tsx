'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'

// Dynamically import AnimatedLogoContent to avoid SSR issues with Three.js
const AnimatedLogoContent = dynamic(
  () => import('@/components/common/widgets/animated-logo-content'),
  { ssr: false }
)

interface User {
  id: string
  x: number
  color: string
  name: string
}

interface Request {
  id: string
  userId: string
  progress: number
  x: number
  icon: string
  color: string
}

interface QuantumLaser {
  id: string
  angle: number
  progress: number
}

interface MatchNotification {
  id: string
  targetUserId: string
  matchedContactId: string // The matched contact being sent to target user
  progress: number
  fromX: number
  toX: number
}

export interface RingAISynapseFlowProps {
  title?: string
  subtitle?: string
  autoPlay?: boolean
  locale?: string
}

// Translations
const translations: Record<string, any> = {
  en: {
    title: 'Ring AI Orchestration',
    subtitle: 'Watch opportunities find people in real-time',
    users: 'Users',
    aiEngine: 'AI Engine',
    quantumField: 'Quantum Field of Possibilities',
    requests: 'Requests',
    matching: 'Matching',
    notifications: 'Match Notifications',
    pause: 'Pause',
    play: 'Play'
  },
  uk: {
    title: 'Ring AI Оркестрація',
    subtitle: 'Дивіться як можливості знаходять людей в реальному часі',
    users: 'Користувачі',
    aiEngine: 'AI Двигун',
    quantumField: 'Квантове Поле Можливостей',
    requests: 'Запити',
    matching: 'Співставлення',
    notifications: 'Повідомлення про Співпадіння',
    pause: 'Пауза',
    play: 'Грати'
  },
  ru: {
    title: 'Ring AI Оркестрация',
    subtitle: 'Смотрите как возможности находят людей в реальном времени',
    users: 'Пользователи',
    aiEngine: 'AI Движок',
    quantumField: 'Квантовое Поле Возможностей',
    requests: 'Запросы',
    matching: 'Сопоставление',
    notifications: 'Уведомления о Совпадениях',
    pause: 'Пауза',
    play: 'Играть'
  }
}

export function RingAISynapseFlow({
  title,
  subtitle,
  autoPlay = true,
  locale = 'en'
}: RingAISynapseFlowProps) {
  const t = translations[locale] || translations.en
  
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [users] = useState<User[]>([
    { id: 'u1', x: 10, color: '#10b981', name: 'Anna' },
    { id: 'u2', x: 25, color: '#3b82f6', name: 'Dmitry' },
    { id: 'u3', x: 40, color: '#8b5cf6', name: 'Olena' },
    { id: 'u4', x: 55, color: '#ec4899', name: 'Ivan' },
    { id: 'u5', x: 70, color: '#f59e0b', name: 'Sofia' },
    { id: 'u6', x: 85, color: '#ef4444', name: 'Max' },
  ])
  
  const [requests, setRequests] = useState<Request[]>([])
  const [quantumLasers, setQuantumLasers] = useState<QuantumLaser[]>([])
  const [matchNotifications, setMatchNotifications] = useState<MatchNotification[]>([])
  const [aiPulse, setAiPulse] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  
  const nextRequestTime = useRef(Date.now())
  const userLastRequestTime = useRef<Record<string, number>>({})
  const userLastMatchTime = useRef<Record<string, number>>({}) // Track last match notification per user
  const intervalRefs = useRef<NodeJS.Timeout[]>([])
  const timeoutRefs = useRef<NodeJS.Timeout[]>([])
  const matchCounter = useRef(0) // Counter for unique match IDs
  
  // Opportunity type icons and colors
  const opportunityTypes = [
    { icon: '❓', color: '#3b82f6', label: 'Question' },
    { icon: '💰', color: '#10b981', label: 'Money' },
    { icon: '📦', color: '#f59e0b', label: 'Product' },
    { icon: '🎓', color: '#8b5cf6', label: 'Education' },
    { icon: '💼', color: '#6366f1', label: 'Job' },
    { icon: '🤝', color: '#ec4899', label: 'Partnership' },
    { icon: '🎯', color: '#ef4444', label: 'Goal' },
    { icon: '💡', color: '#eab308', label: 'Idea' },
  ]
  
  // Fix hydration: only start animations after mount
  useEffect(() => {
    setMounted(true)
    
    // Cleanup all intervals and timeouts on unmount
    return () => {
      intervalRefs.current.forEach(interval => clearInterval(interval))
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout))
      intervalRefs.current = []
      timeoutRefs.current = []
    }
  }, [])

  // Auto-pause when tab/window not visible (prevents queue buildup)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden
      setIsVisible(visible)
      // Reset next request time when becoming visible to prevent queue buildup
      if (visible) {
        nextRequestTime.current = Date.now() + 1000
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Also handle window focus/blur
    const handleFocus = () => {
      setIsVisible(true)
      nextRequestTime.current = Date.now() + 1000
    }
    const handleBlur = () => setIsVisible(false)
    
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  // Generate user requests (random 3-5 seconds per user, max 1 bubble per user at a time)
  useEffect(() => {
    if (!isPlaying || !mounted || !isVisible) return

    const interval = setInterval(() => {
      const now = Date.now()
      
      // Check each user for potential request
      users.forEach(user => {
        const lastRequest = userLastRequestTime.current[user.id] || 0
        const timeSinceLastRequest = now - lastRequest
        const minInterval = 3000 // 3 seconds
        const maxInterval = 5000 // 5 seconds
        
        // Random chance within the 3-5 second window
        if (timeSinceLastRequest >= minInterval) {
          const shouldSend = Math.random() < 0.1 || timeSinceLastRequest >= maxInterval
          
          if (shouldSend) {
            const randomType = opportunityTypes[Math.floor(Math.random() * opportunityTypes.length)]
            
            const newRequest: Request = {
              id: `req-${Date.now()}-${user.id}-${Math.random()}`,
              userId: user.id,
              progress: 0,
              x: user.x,
              icon: randomType.icon,
              color: randomType.color
            }
            
            setRequests(prev => [...prev, newRequest])
            userLastRequestTime.current[user.id] = now
          }
        }
      })
    }, 100)

    intervalRefs.current.push(interval)
    return () => {
      clearInterval(interval)
      intervalRefs.current = intervalRefs.current.filter(i => i !== interval)
    }
  }, [isPlaying, mounted, isVisible, users])

  // Animate request progress
  useEffect(() => {
    if (!isPlaying || !mounted || !isVisible) return

    const interval = setInterval(() => {
      setRequests(prev => 
        prev
          .map(req => ({ ...req, progress: req.progress + 0.015 }))
          .filter(req => req.progress <= 1)
      )
    }, 20)

    intervalRefs.current.push(interval)
    return () => {
      clearInterval(interval)
      intervalRefs.current = intervalRefs.current.filter(i => i !== interval)
    }
  }, [isPlaying, mounted, isVisible])

  // When request reaches AI, trigger AI pulse and quantum lasers
  useEffect(() => {
    const reachedRequests = requests.filter(r => r.progress >= 0.45 && r.progress <= 0.5)
    
    if (reachedRequests.length > 0) {
      setAiPulse(true)
      const pulseTimeout = setTimeout(() => setAiPulse(false), 300)
      timeoutRefs.current.push(pulseTimeout)
      
      // Fire corona-like lasers (fewer, reaching further into quantum field)
      const laserCount = 5 + Math.floor(Math.random() * 2) // 2-3 lasers only for corona effect
      const newLasers: QuantumLaser[] = []
      
      // Create elegant corona spread
      for (let i = 0; i < laserCount; i++) {
        const baseAngle = -90 // Point upward toward quantum field
        const spread = 100 // 100 degree spread for corona
        const angle = baseAngle + (i / Math.max(1, laserCount - 1)) * spread - (spread / 2)
        
        newLasers.push({
          id: `laser-${Date.now()}-${i}`,
          angle: angle,
          progress: 0
        })
      }
      
      setQuantumLasers(prev => [...prev, ...newLasers])
      
      // After quantum interaction, send match notification to random user (throttled: max 1 per 5 seconds per user)
      const matchTimeout = setTimeout(() => {
        const now = Date.now()
        
        // Filter users who haven't received a match in last 5 seconds
        const availableUsers = users.filter(user => {
          const lastMatchTime = userLastMatchTime.current[user.id] || 0
          return (now - lastMatchTime) >= 3000 // 5 second throttle
        })
        
        // Only send if there are available users
        if (availableUsers.length > 0) {
          const targetUser = availableUsers[Math.floor(Math.random() * availableUsers.length)]
          
          // Select a different user as the "matched contact" to send to target
          const availableContacts = users.filter(u => u.id !== targetUser.id)
          const matchedContact = availableContacts[Math.floor(Math.random() * availableContacts.length)]
          
          matchCounter.current += 1
          
          const notification: MatchNotification = {
            id: `match-${Date.now()}-${matchCounter.current}`,
            targetUserId: targetUser.id,
            matchedContactId: matchedContact.id, // Different user being matched
            progress: 0,
            fromX: 50,
            toX: targetUser.x
          }
          
          setMatchNotifications(prev => [...prev, notification])
          userLastMatchTime.current[targetUser.id] = now // Record the time
        }
      }, 400)
      timeoutRefs.current.push(matchTimeout)
    }
  }, [requests, users])

  // Animate quantum lasers
  useEffect(() => {
    if (!isPlaying || !mounted || !isVisible) return

    const interval = setInterval(() => {
      setQuantumLasers(prev =>
        prev
          .map(laser => ({ ...laser, progress: laser.progress + 0.03 }))
          .filter(laser => laser.progress <= 1)
      )
    }, 20)

    intervalRefs.current.push(interval)
    return () => {
      clearInterval(interval)
      intervalRefs.current = intervalRefs.current.filter(i => i !== interval)
    }
  }, [isPlaying, mounted])

  // Animate match notifications (2x speed)
  useEffect(() => {
    if (!isPlaying || !mounted || !isVisible) return

    const interval = setInterval(() => {
      setMatchNotifications(prev =>
        prev
          .map(notif => ({ ...notif, progress: notif.progress + 0.12 }))
          .filter(notif => notif.progress <= 1)
      )
    }, 20)

    intervalRefs.current.push(interval)
    return () => {
      clearInterval(interval)
      intervalRefs.current = intervalRefs.current.filter(i => i !== interval)
    }
  }, [isPlaying, mounted, isVisible])

  // Deterministic particle positions (fixes hydration)
  const particlePositions = [
    { left: 10, top: 15 }, { left: 25, top: 30 }, { left: 40, top: 20 },
    { left: 55, top: 45 }, { left: 70, top: 25 }, { left: 85, top: 50 },
    { left: 15, top: 60 }, { left: 30, top: 75 }, { left: 50, top: 65 },
    { left: 65, top: 80 }, { left: 80, top: 70 }, { left: 20, top: 40 },
    { left: 45, top: 55 }, { left: 60, top: 35 }, { left: 75, top: 85 },
    { left: 35, top: 90 }, { left: 90, top: 60 }, { left: 12, top: 85 },
    { left: 48, top: 12 }, { left: 88, top: 22 }
  ]

  return (
    <div className="w-full my-8">
      {/* Header */}
      <div className="text-center mb-6">
        <motion.h2
          className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {title || t.title}
        </motion.h2>
        {(subtitle !== undefined ? subtitle : t.subtitle) && (
          <motion.p
            className="text-sm text-gray-600 dark:text-gray-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {subtitle !== undefined ? subtitle : t.subtitle}
          </motion.p>
        )}
      </div>

      {/* Main Visualization */}
      <motion.div
        className="relative w-full h-[500px] sm:h-[600px] bg-gradient-to-b from-purple-900 via-indigo-900 to-slate-900 rounded-3xl shadow-2xl overflow-hidden mx-auto"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Background stars - only render after mount to fix hydration */}
        {mounted && (
          <div className="absolute inset-0">
            {particlePositions.map((pos, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-white rounded-full"
                style={{
                  left: `${pos.left}%`,
                  top: `${pos.top}%`,
                }}
                animate={{
                  opacity: [0.2, 0.8, 0.2],
                  scale: [1, 1.5, 1],
                }}
                transition={{
                  duration: 2 + (i % 3),
                  repeat: Infinity,
                  delay: i * 0.1,
                }}
              />
            ))}
          </div>
        )}

        {/* SVG Layer for connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <linearGradient id="requestGradient" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="laserGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="1" />
            </linearGradient>
            <linearGradient id="matchGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="1" />
            </linearGradient>
            
            {/* Glow filters */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* User request bubbles rising to quantum field */}
          <AnimatePresence>
            {requests.map(req => {
              const startY = 90
              const endY = 20 // Reach quantum field area (top)
              const currentY = startY - (startY - endY) * req.progress
              // Fade out as it approaches middle (becomes transparent in quantum field)
              const opacity = req.progress < 0.6 ? 1 : (1 - req.progress) * 2.5
              const scale = 1 + req.progress * 0.2 // Slightly grow as it rises
              
              return (
                <motion.g key={req.id}>
                  {/* Bubble circle */}
                  <motion.circle
                    cx={`${req.x}%`}
                    cy={`${currentY}%`}
                    r="16"
                    fill={req.color}
                    fillOpacity={0.2}
                    stroke={req.color}
                    strokeWidth="2"
                    filter="url(#glow)"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ 
                      opacity: opacity * 0.8,
                      scale: [0, scale, scale]
                    }}
                    transition={{ 
                      opacity: { duration: 2, ease: "easeOut" },
                      scale: { duration: 0.3 }
                    }}
                    exit={{ opacity: 0, scale: 0 }}
                  />
                  {/* Icon inside bubble */}
                  <motion.text
                    x={`${req.x}%`}
                    y={`${currentY}%`}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="20"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: opacity }}
                    transition={{ duration: 2, ease: "easeOut" }}
                    exit={{ opacity: 0 }}
                  >
                    {req.icon}
                  </motion.text>
                </motion.g>
              )
            })}
          </AnimatePresence>

          {/* Quantum corona lasers from AI - reaching to quantum field */}
          <AnimatePresence>
            {quantumLasers.map(laser => {
              const centerX = 50
              const centerY = 50
              const length = 60 * laser.progress // Reach further (60 vs 40)
              const radians = (laser.angle * Math.PI) / 180
              const endX = centerX + Math.cos(radians) * length
              const endY = centerY + Math.sin(radians) * length
              // Wider, more dramatic corona beams
              const opacity = laser.progress < 0.5 ? laser.progress * 2 : (1 - laser.progress) * 2
              
              return (
                <motion.line
                  key={laser.id}
                  x1={`${centerX}%`}
                  y1={`${centerY}%`}
                  x2={`${endX}%`}
                  y2={`${endY}%`}
                  stroke="url(#laserGradient)"
                  strokeWidth="4"
                  opacity={opacity * 0.9}
                  filter="url(#glow)"
                  initial={{ opacity: 0, strokeWidth: 0 }}
                  animate={{ 
                    opacity: [0, opacity * 0.9, opacity * 0.5, 0],
                    strokeWidth: [0, 5, 4, 2]
                  }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  exit={{ opacity: 0 }}
                />
              )
            })}
          </AnimatePresence>

          {/* Match notifications to users */}
          <AnimatePresence>
            {matchNotifications.map(notif => {
              const startY = 50
              const endY = 90
              const currentY = startY + (endY - startY) * notif.progress
              const currentX = notif.fromX + (notif.toX - notif.fromX) * notif.progress
              // Fade out as it approaches user
              const opacity = notif.progress < 0.85 ? 0.9 : (1 - notif.progress) * 6
              
              // Get the target user for this notification
              const targetUser = users.find(u => u.id === notif.targetUserId)
              
              return (
                <motion.g key={notif.id}>
                  {/* Pulsing line from AI to current position */}
                  <motion.line
                    x1={`${notif.fromX}%`}
                    y1={`${startY}%`}
                    x2={`${currentX}%`}
                    y2={`${currentY}%`}
                    stroke="url(#matchGradient)"
                    strokeWidth="3"
                    filter="url(#glow)"
                    initial={{ opacity: 0 }}
                    animate={{ 
                      opacity: [0, opacity * 0.9, opacity * 0.9, opacity * 0.5],
                      strokeWidth: [2, 3, 3, 1]
                    }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    exit={{ opacity: 0 }}
                  />
                  
                  {/* Success burst when reaching user */}
                  {notif.progress > 0.95 && (
                    <motion.circle
                      cx={`${currentX}%`}
                      cy={`${currentY}%`}
                      r="15"
                      fill="none"
                      stroke="url(#matchGradient)"
                      strokeWidth="2"
                      initial={{ scale: 0, opacity: 0.8 }}
                      animate={{ 
                        scale: [0, 2],
                        opacity: [0.8, 0]
                      }}
                      transition={{ duration: 0.6 }}
                    />
                  )}
                </motion.g>
              )
            })}
          </AnimatePresence>
          
          {/* Matched contact icons floating down to target users */}
          <AnimatePresence>
            {matchNotifications.map(notif => {
              const startY = 50
              const endY = 90
              const currentY = startY + (endY - startY) * notif.progress
              const currentX = notif.fromX + (notif.toX - notif.fromX) * notif.progress
              const opacity = notif.progress < 0.85 ? 1 : (1 - notif.progress) * 6
              
              // Get the matched contact (the person being sent as a match)
              const matchedContact = users.find(u => u.id === notif.matchedContactId)
              
              return (
                <motion.g key={`${notif.id}-icon`}>
                  <motion.foreignObject
                    x={`${currentX}%`}
                    y={`${currentY}%`}
                    width="32"
                    height="32"
                    style={{ overflow: 'visible', transform: 'translate(-16px, -16px)' }}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ 
                      opacity: opacity,
                      scale: [0, 1.2, 1]
                    }}
                    transition={{ 
                      scale: { duration: 0.4 },
                      opacity: { duration: 0.3 }
                    }}
                    exit={{ opacity: 0, scale: 0 }}
                  >
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-emerald-400"
                      style={{
                        background: matchedContact ? `linear-gradient(135deg, ${matchedContact.color}, ${matchedContact.color}dd)` : '#10b981',
                        boxShadow: '0 0 12px rgba(16, 185, 129, 0.6)'
                      }}
                    >
                      <span className="text-white text-sm">👤</span>
                    </div>
                  </motion.foreignObject>
                </motion.g>
              )
            })}
          </AnimatePresence>
        </svg>

        {/* Quantum Field (Top) */}
        <motion.div
          className="absolute top-3 sm:top-4 left-1/2 transform -translate-x-1/2 text-center z-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="text-pink-300 font-bold text-xs sm:text-sm flex items-center gap-1 sm:gap-2 justify-center">
            <span className="text-base sm:text-xl">✨</span>
            <span className="whitespace-nowrap">{t.quantumField}</span>
          </div>
        </motion.div>

        {/* AI Engine (Center) - 3D Animated Ring Logo */}
        <motion.div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
        >
          <motion.div
            className="relative"
            animate={{
              scale: aiPulse ? 1.15 : 1,
            }}
            transition={{ duration: 0.3 }}
          >
            {/* 3D Animated Ring - Direct rendering without background circle */}
            <div className="relative flex items-center justify-center">
              <div className="scale-[2.1] sm:scale-[2.5]">
                {mounted && <AnimatedLogoContent size={96} />}
              </div>
              
              {/* AI Engine Label */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-8">
                <div className="bg-gradient-to-r from-indigo-600/90 to-purple-600/90 backdrop-blur-md px-3 py-1 rounded-full border border-purple-400/50">
                  <span className="text-white text-[10px] sm:text-xs font-bold whitespace-nowrap">
                    {t.aiEngine}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Users (Bottom) */}
        <div className="absolute bottom-4 sm:bottom-8 left-0 right-0 px-2 sm:px-4">
          <div className="text-center mb-2">
            <span className="text-emerald-300 font-bold text-xs sm:text-sm">{t.users}</span>
          </div>
          <div className="relative h-14 sm:h-16">
            {users.map((user, idx) => (
              <motion.div
                key={user.id}
                className="absolute bottom-0"
                style={{ left: `${user.x}%` }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + idx * 0.1 }}
              >
                <motion.div
                  className="transform -translate-x-1/2"
                  animate={{
                    y: [0, -3, 0],
                  }}
                  transition={{
                    duration: 2 + (idx % 3) * 0.5,
                    repeat: Infinity,
                    delay: idx * 0.3,
                  }}
                >
                  <div
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-lg border-2 border-white/50"
                    style={{
                      background: `linear-gradient(135deg, ${user.color}, ${user.color}dd)`,
                    }}
                  >
                    <span className="text-white text-sm sm:text-lg">👤</span>
                  </div>
                  <div className="text-[10px] sm:text-xs text-white/80 text-center mt-1 font-medium whitespace-nowrap">
                    {user.name}
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Control Button */}
        <motion.div
          className="absolute bottom-4 right-4 z-30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-md shadow-lg border border-white/20 flex items-center gap-2 text-sm font-medium text-white hover:bg-white/20 transition-all"
          >
            {isPlaying ? '⏸️' : '▶️'} {isPlaying ? t.pause : t.play}
          </button>
        </motion.div>
      </motion.div>
    </div>
  )
}

