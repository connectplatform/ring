'use client'

import React from 'react'
import { collectDiagramSource } from '@/components/docs/diagram-source'
import { Mermaid } from './mermaid'

export interface MindMapProps {
  children: React.ReactNode
  title?: string
}

/**
 * Thin alias for mindmap diagrams — corpus standard is still <Mermaid>{`mindmap …`}</Mermaid>.
 */
export function MindMap({ children, title }: MindMapProps) {
  const raw = collectDiagramSource(children).trim()
  if (!raw) return null

  const diagramCode = raw.startsWith('mindmap') ? raw : `mindmap\n${raw}`

  return (
    <Mermaid title={title} type="mindmap">
      {diagramCode}
    </Mermaid>
  )
}
