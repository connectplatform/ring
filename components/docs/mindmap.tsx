'use client'

import React from 'react'
import { Mermaid } from './mermaid'

export interface MindMapProps {
  children: string
  title?: string
}

/**
 * MindMap component - wrapper around Mermaid for mindmap diagrams
 * Provides cleaner API for mindmap-specific usage
 * 
 * Usage:
 * <MindMap title="My Mind Map">
 * {`mindmap
 *   root((Central Idea))
 *     Branch 1
 *       Leaf 1
 *       Leaf 2
 *     Branch 2
 *       Leaf 3
 * `}
 * </MindMap>
 */
export function MindMap({ children, title }: MindMapProps) {
  // Ensure the children starts with 'mindmap' directive
  const diagramCode = children.trim().startsWith('mindmap') 
    ? children 
    : `mindmap\n${children}`

  return <Mermaid title={title} type="mindmap">{diagramCode}</Mermaid>
}

