"use client";

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { List } from 'lucide-react'

interface TOCItem {
  id: string
  text: string
  level: number
}

interface TableOfContentsProps {
  content: string
  className?: string
}

export function TableOfContents({ content, className = '' }: TableOfContentsProps) {
  const [tocItems, setTocItems] = useState<TOCItem[]>([])
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    // Extract headings from HTML content
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = content

    const headings = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6')
    const items: TOCItem[] = []

    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1))
      const text = heading.textContent?.trim() || ''
      const id = heading.id || `heading-${index}`

      // Add ID to heading if it doesn't have one
      if (!heading.id) {
        heading.id = id
      }

      items.push({
        id,
        text,
        level
      })
    })

    setTocItems(items)

    // Update content with IDs
    const updatedContent = tempDiv.innerHTML

    // Update the article content with the IDs
    const articleContent = document.querySelector('.article-content')
    if (articleContent) {
      articleContent.innerHTML = updatedContent
    }
  }, [content])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      { rootMargin: '-100px 0px -80% 0px' }
    )

    tocItems.forEach((item) => {
      const element = document.getElementById(item.id)
      if (element) {
        observer.observe(element)
      }
    })

    return () => observer.disconnect()
  }, [tocItems])

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      const offsetTop = element.offsetTop - 100 // Account for sticky header
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      })
    }
  }

  if (tocItems.length === 0) {
    return null
  }

  return (
    <Card className={`sticky top-4 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <List className="h-5 w-5" />
          Table of Contents
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <nav>
          <ul className="space-y-1">
            {tocItems.map((item) => (
              <li
                key={item.id}
                style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
              >
                <Button
                  variant="ghost"
                  className={`justify-start text-left w-full h-auto py-1 px-2 text-sm hover:bg-accent ${
                    activeId === item.id ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground'
                  }`}
                  onClick={() => scrollToHeading(item.id)}
                >
                  {item.text}
                </Button>
              </li>
            ))}
          </ul>
        </nav>
      </CardContent>
    </Card>
  )
}
