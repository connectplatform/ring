'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Node {
  id: string
  label: string
  x: number
  y: number
  world: 'physical' | 'ring' | 'quantum'
  icon?: string
}

interface Connection {
  id: string
  from: string
  to: string
  progress: number
  type: 'flow' | 'manifest'
}

export interface RingGatewayFlowProps {
  title?: string
  subtitle?: string
  autoPlay?: boolean
  locale?: string
}

// Translations
const translations: Record<string, any> = {
  en: {
    title: 'The Ring Gateway System',
    subtitle: 'Connecting opportunities with people in real-time',
    physicalWorld: 'Physical World',
    ringGateway: 'Ring Gateway', 
    quantumWorld: 'Quantum World',
    nodes: {
      physical: ['Humans with Needs', 'Humans with Skills', 'Businesses', 'Organizations'],
      ring: ['AI Orchestration', 'Direct Messages', '8-Factor Matching', 'Real-time Streams'],
      quantum: ['Infinite Opportunities', 'Serendipitous Connections', 'Collective Solutions', 'Information Abundance']
    }
  },
  uk: {
    title: 'Система Ring Gateway',
    subtitle: 'З\'єднання можливостей з людьми в реальному часі',
    physicalWorld: 'Фізичний Світ',
    ringGateway: 'Ring Шлюз',
    quantumWorld: 'Квантовий Світ',
    nodes: {
      physical: ['Люди з Потребами', 'Люди з Навичками', 'Бізнеси', 'Організації'],
      ring: ['AI Оркестрація', 'Прямі Повідомлення', '8-Факторне Співставлення', 'Потоки в Реальному Часі'],
      quantum: ['Нескінченні Можливості', 'Несподівані Зв\'язки', 'Колективні Рішення', 'Інформаційне Багатство']
    }
  },
  ru: {
    title: 'Система Ring Gateway',
    subtitle: 'Соединение возможностей с людьми в реальном времени',
    physicalWorld: 'Физический Мир',
    ringGateway: 'Ring Шлюз',
    quantumWorld: 'Квантовый Мир',
    nodes: {
      physical: ['Люди с Потребностями', 'Люди с Навыками', 'Бизнесы', 'Организации'],
      ring: ['AI Оркестрация', 'Прямые Сообщения', '8-Факторное Сопоставление', 'Потоки в Реальном Времени'],
      quantum: ['Бесконечные Возможности', 'Неожиданные Связи', 'Коллективные Решения', 'Информационное Изобилие']
    }
  }
}

export function RingGatewayFlow({ 
  title, 
  subtitle, 
  autoPlay = true,
  locale = 'en'
}: RingGatewayFlowProps) {
  const t = translations[locale] || translations.en
  
  const [nodes, setNodes] = useState<Node[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [activeNode, setActiveNode] = useState<string | null>(null)

  // Initialize nodes with specific positioning like codepen
  useEffect(() => {
    const physicalIcons = ['👤', '🎯', '💼', '🏢']
    const ringIcons = ['🤖', '✉️', '🎲', '📡']
    const quantumIcons = ['🌟', '🔗', '💡', '📚']
    
    const newNodes: Node[] = [
      // Physical world nodes (top section) - matching codepen layout
      { id: 'physical-0', label: t.nodes.physical[0], x: -70, y: -80, world: 'physical', icon: physicalIcons[0] },
      { id: 'physical-1', label: t.nodes.physical[1], x: 70, y: -75, world: 'physical', icon: physicalIcons[1] },
      { id: 'physical-2', label: t.nodes.physical[2], x: -80, y: -55, world: 'physical', icon: physicalIcons[2] },
      { id: 'physical-3', label: t.nodes.physical[3], x: 80, y: -55, world: 'physical', icon: physicalIcons[3] },
      
      // Ring Gateway nodes (center) - around the central ring
      { id: 'ring-0', label: t.nodes.ring[0], x: -85, y: -10, world: 'ring', icon: ringIcons[0] },
      { id: 'ring-1', label: t.nodes.ring[1], x: 85, y: -10, world: 'ring', icon: ringIcons[1] },
      { id: 'ring-2', label: t.nodes.ring[2], x: -85, y: 20, world: 'ring', icon: ringIcons[2] },
      { id: 'ring-3', label: t.nodes.ring[3], x: 85, y: 20, world: 'ring', icon: ringIcons[3] },
      
      // Quantum world nodes (bottom section)
      { id: 'quantum-0', label: t.nodes.quantum[0], x: -80, y: 60, world: 'quantum', icon: quantumIcons[0] },
      { id: 'quantum-1', label: t.nodes.quantum[1], x: 80, y: 60, world: 'quantum', icon: quantumIcons[1] },
      { id: 'quantum-2', label: t.nodes.quantum[2], x: -70, y: 85, world: 'quantum', icon: quantumIcons[2] },
      { id: 'quantum-3', label: t.nodes.quantum[3], x: 70, y: 85, world: 'quantum', icon: quantumIcons[3] },
    ]
    
    setNodes(newNodes)
  }, [locale, t.nodes])

  // Animation loop for connections
  useEffect(() => {
    if (!isPlaying || nodes.length === 0) return

    const connectionInterval = setInterval(() => {
      // Create flow connections (physical to ring)
      if (Math.random() > 0.3) {
        const physicalNodes = nodes.filter(n => n.world === 'physical')
        const ringNodes = nodes.filter(n => n.world === 'ring')
        
        const fromNode = physicalNodes[Math.floor(Math.random() * physicalNodes.length)]
        const toNode = ringNodes[Math.floor(Math.random() * ringNodes.length)]
        
        const newConnection: Connection = {
          id: `flow-${Date.now()}`,
          from: fromNode.id,
          to: toNode.id,
          progress: 0,
          type: 'flow'
        }
        
        setConnections(prev => [...prev, newConnection])
      }
      
      // Create manifest connections (quantum to physical)
      if (Math.random() > 0.5) {
        const quantumNodes = nodes.filter(n => n.world === 'quantum')
        const physicalNodes = nodes.filter(n => n.world === 'physical')
        
        const fromNode = quantumNodes[Math.floor(Math.random() * quantumNodes.length)]
        const toNode = physicalNodes[Math.floor(Math.random() * physicalNodes.length)]
        
        const newConnection: Connection = {
          id: `manifest-${Date.now()}`,
          from: fromNode.id,
          to: toNode.id,
          progress: 0,
          type: 'manifest'
        }
        
        setConnections(prev => [...prev, newConnection])
      }
    }, 800)

    return () => clearInterval(connectionInterval)
  }, [isPlaying, nodes])

  // Animate connection progress
  useEffect(() => {
    const interval = setInterval(() => {
      setConnections(prev => 
        prev
          .map(conn => ({ ...conn, progress: conn.progress + 0.02 }))
          .filter(conn => conn.progress <= 1)
      )
    }, 20)

    return () => clearInterval(interval)
  }, [])

  const getNodePosition = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    return node || { x: 0, y: 0 }
  }

  return (
    <div className="w-full p-4">
      {/* Header */}
      <div className="text-center mb-6">
        <motion.h2 
          className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2"
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

      {/* Mindmap Container */}
      <motion.div 
        className="relative w-full h-[600px] bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-indigo-950 dark:to-purple-950 rounded-3xl shadow-2xl overflow-hidden"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Floating particles - like codepen */}
        <div className="absolute inset-0">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-gradient-to-br from-indigo-400 to-pink-400 opacity-60"
              style={{
                left: `${10 + i * 15}%`,
              }}
              animate={{
                y: ['100%', '-100%'],
                rotate: [0, 720],
                opacity: [0, 0.6, 0.6, 0],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "linear",
                delay: i * 2,
              }}
            />
          ))}
        </div>

        {/* SVG for static connections - matching codepen */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="manifestGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ec4899" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Static dashed connection lines - always visible */}
          {/* Flow connections (Physical to Ring) */}
          <motion.path
            d="M 25 13 Q 37 25 50 43"
            stroke="url(#flowGradient)"
            strokeWidth="2"
            strokeDasharray="5,5"
            fill="none"
            opacity="0.3"
            animate={{ strokeDashoffset: [0, -1000] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          <motion.path
            d="M 75 13 Q 63 25 50 43"
            stroke="url(#flowGradient)"
            strokeWidth="2"
            strokeDasharray="5,5"
            fill="none"
            opacity="0.3"
            animate={{ strokeDashoffset: [0, -1000] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          <motion.path
            d="M 38 17 Q 42 30 50 43"
            stroke="url(#flowGradient)"
            strokeWidth="2"
            strokeDasharray="5,5"
            fill="none"
            opacity="0.3"
            animate={{ strokeDashoffset: [0, -1000] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          <motion.path
            d="M 63 17 Q 58 30 50 43"
            stroke="url(#flowGradient)"
            strokeWidth="2"
            strokeDasharray="5,5"
            fill="none"
            opacity="0.3"
            animate={{ strokeDashoffset: [0, -1000] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          
          {/* Manifest connections (Quantum to Physical) */}
          <motion.path
            d="M 25 83 Q 13 50 25 13"
            stroke="url(#manifestGradient)"
            strokeWidth="2"
            strokeDasharray="5,5"
            fill="none"
            opacity="0.3"
            animate={{ strokeDashoffset: [0, -1000] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          <motion.path
            d="M 75 83 Q 88 50 75 13"
            stroke="url(#manifestGradient)"
            strokeWidth="2"
            strokeDasharray="5,5"
            fill="none"
            opacity="0.3"
            animate={{ strokeDashoffset: [0, -1000] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          <motion.path
            d="M 38 80 Q 25 50 38 17"
            stroke="url(#manifestGradient)"
            strokeWidth="2"
            strokeDasharray="5,5"
            fill="none"
            opacity="0.3"
            animate={{ strokeDashoffset: [0, -1000] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          <motion.path
            d="M 63 80 Q 75 50 63 17"
            stroke="url(#manifestGradient)"
            strokeWidth="2"
            strokeDasharray="5,5"
            fill="none"
            opacity="0.3"
            animate={{ strokeDashoffset: [0, -1000] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />

          {/* Animated pulse dots traveling along connections */}
          <AnimatePresence>
            {connections.map(conn => {
              const from = getNodePosition(conn.from)
              const to = getNodePosition(conn.to)
              
              const startX = 50 + from.x / 2
              const startY = 50 + from.y / 2
              const endX = 50 + to.x / 2
              const endY = 50 + to.y / 2
              
              const currentX = startX + (endX - startX) * conn.progress
              const currentY = startY + (endY - startY) * conn.progress
              
              return (
                <motion.circle
                  key={conn.id}
                  cx={`${currentX}%`}
                  cy={`${currentY}%`}
                  r="4"
                  fill={conn.type === 'flow' ? 'url(#flowGradient)' : 'url(#manifestGradient)'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.8, 0.8, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 2 }}
                />
              )
            })}
          </AnimatePresence>
        </svg>

        {/* World Labels */}
        <motion.div 
          className="absolute top-8 left-1/2 transform -translate-x-1/2 text-center"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <span>🌍</span> {t.physicalWorld}
          </div>
        </motion.div>

        <motion.div 
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
        >
          <motion.div 
            className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl"
            animate={{
              boxShadow: [
                '0 0 20px rgba(99, 102, 241, 0.4)',
                '0 0 40px rgba(139, 92, 246, 0.6)',
                '0 0 20px rgba(99, 102, 241, 0.4)'
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="text-center text-white">
              <div className="text-2xl">💎</div>
              <div className="text-xs font-bold mt-1">{t.ringGateway}</div>
            </div>
          </motion.div>
        </motion.div>

        <motion.div 
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="text-lg font-bold text-pink-600 dark:text-pink-400 flex items-center gap-2">
            <span>✨</span> {t.quantumWorld}
          </div>
        </motion.div>

        {/* Floating Nodes */}
        <AnimatePresence>
          {nodes.map((node, idx) => (
            <motion.div
              key={node.id}
              className="absolute"
              style={{
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) translate(${node.x * 3}px, ${node.y * 3}px)`,
                zIndex: activeNode === node.id ? 30 : 10
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: activeNode === node.id ? 1.1 : 1, 
                opacity: 1,
                y: [0, -5, 0]
              }}
              transition={{
                scale: { duration: 0.3 },
                opacity: { duration: 0.5, delay: idx * 0.05 },
                y: { duration: 3 + Math.random() * 2, repeat: Infinity, ease: "easeInOut" }
              }}
              onHoverStart={() => setActiveNode(node.id)}
              onHoverEnd={() => setActiveNode(null)}
              whileTap={{ scale: 0.95 }}
              whileHover={{ 
                scale: 1.05,
                rotate: Math.random() * 10 - 5
              }}
            >
              <div className={`
                px-3 py-2 rounded-2xl backdrop-blur-sm shadow-lg cursor-pointer
                ${node.world === 'physical' 
                  ? 'bg-emerald-100/70 dark:bg-emerald-900/30 border border-emerald-400 dark:border-emerald-600' 
                  : node.world === 'ring'
                  ? 'bg-indigo-100/70 dark:bg-indigo-900/30 border border-indigo-400 dark:border-indigo-600'
                  : 'bg-pink-100/70 dark:bg-pink-900/30 border border-pink-400 dark:border-pink-600'}
                transition-all duration-300
              `}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{node.icon}</span>
                  <span className={`text-xs font-medium
                    ${node.world === 'physical' 
                      ? 'text-emerald-700 dark:text-emerald-300' 
                      : node.world === 'ring'
                      ? 'text-indigo-700 dark:text-indigo-300'
                      : 'text-pink-700 dark:text-pink-300'}
                  `}>
                    {node.label}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Control Button */}
        <motion.div 
          className="absolute bottom-4 right-4 z-30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-4 py-2 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-lg border border-gray-200 dark:border-gray-700 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:scale-105 transition-transform"
          >
            {isPlaying ? '⏸️' : '▶️'} {isPlaying ? 'Pause' : 'Play'}
          </button>
        </motion.div>
      </motion.div>

      {/* Mobile-friendly legend */}
      <motion.div 
        className="mt-6 p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded"></div>
            <span className="text-gray-600 dark:text-gray-400">Flow to Gateway</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-gradient-to-r from-pink-500 to-rose-500 rounded"></div>
            <span className="text-gray-600 dark:text-gray-400">Manifest to Reality</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}