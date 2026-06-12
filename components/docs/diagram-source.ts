import React from 'react'

/** Recursively extract plain text from MDX/React children (template literals, nested nodes). */
export function collectDiagramSource(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(collectDiagramSource).join('')
  if (React.isValidElement(node)) {
    const p = node.props as { children?: React.ReactNode }
    return collectDiagramSource(p.children)
  }
  return ''
}
