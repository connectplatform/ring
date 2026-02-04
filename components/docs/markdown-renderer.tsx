'use client'

import React from 'react'

interface MarkdownRendererProps {
  htmlContent: string
}

export function MarkdownRenderer({ htmlContent }: MarkdownRendererProps) {
  return (
    <div className="max-w-none">
      <style jsx global>{`
        /* H1 styling */
        .markdown-content h1 {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 1.5rem;
          margin-top: 2rem;
          line-height: 1.2;
        }
        
        /* H2 styling */
        .markdown-content h2 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 1rem;
          margin-top: 2rem;
          line-height: 1.3;
        }
        
        /* H3 styling */
        .markdown-content h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
          margin-top: 1.5rem;
          line-height: 1.4;
        }
        
        /* Paragraph styling */
        .markdown-content p {
          margin-bottom: 1rem;
          line-height: 1.6;
        }
        
        /* List styling */
        .markdown-content ul {
          margin-bottom: 1rem;
          margin-left: 1.5rem;
          list-style-type: disc;
        }
        
        .markdown-content ol {
          margin-bottom: 1rem;
          margin-left: 1.5rem;
          list-style-type: decimal;
        }
        
        .markdown-content li {
          margin-bottom: 0.25rem;
        }
        
        /* Code styling */
        .markdown-content code {
          background-color: rgba(0, 0, 0, 0.05);
          padding: 0.2rem 0.4rem;
          border-radius: 0.25rem;
          font-family: monospace;
          font-size: 0.875rem;
        }
        
        .dark .markdown-content code {
          background-color: rgba(255, 255, 255, 0.1);
        }
        
        /* Pre/code block styling */
        .markdown-content pre {
          background-color: #f6f8fa;
          border: 1px solid #d1d9e0;
          border-radius: 0.375rem;
          padding: 1rem;
          margin: 1.5rem 0;
          overflow-x: auto;
        }

        .dark .markdown-content pre {
          background-color: #161b22;
          border-color: #30363d;
        }
        
        .markdown-content pre code {
          background-color: transparent;
          padding: 0;
          border-radius: 0;
        }
        
        /* Blockquote styling */
        .markdown-content blockquote {
          border-left: 4px solid #3b82f6;
          padding-left: 1rem;
          font-style: italic;
          margin: 1rem 0;
          color: #6b7280;
        }
        
        .dark .markdown-content blockquote {
          color: #9ca3af;
        }
        
        /* Strong/bold styling */
        .markdown-content strong {
          font-weight: 600;
        }
      `}</style>
      <div 
        className="markdown-content prose prose-lg max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  )
}
