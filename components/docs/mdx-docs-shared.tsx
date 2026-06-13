/**
 * Shared MDX component map + serialization options for Ring docs (library index + slug pages).
 *
 * - remark-gfm: GFM tables, strikethrough, task lists, autolinks (not provided by remark-mdx alone).
 * - Mermaid / MindMap / RingAISynapseFlow: MDX JSX components — not remark plugins; expose them here so
 *   `docs/{locale}/index.mdx` can use the same blocks as deeper pages.
 * - Fenced code: `rehypeCodeFenceToMdx` → async `<Code>` → server Shiki (`highlightCodeToHtml`).
 */
import React from 'react'
import Image from 'next/image'
import remarkGfm from 'remark-gfm'
import { rehypeMermaidFenceToMdx } from '@/components/docs/rehype-mermaid-fence'
import { rehypeCodeFenceToMdx } from '@/components/docs/rehype-code-fence-to-mdx'
import { Callout } from '@/components/docs/callout'
import { Steps, Step } from '@/components/docs/steps'
import {
  Card as UiCard,
  CardContent as UiCardContent,
  CardDescription as UiCardDescription,
  CardHeader as UiCardHeader,
  CardTitle as UiCardTitle,
} from '@/components/ui/card'
import { Card, Cards } from '@/components/docs/card'
import { Mermaid } from '@/components/docs/mermaid'
import { Code } from '@/components/docs/code'
import { InlineCode } from '@/components/docs/inline-code'
import { Tabs, Tab } from '@/components/docs/tabs'
import {
  CodeSandbox,
  Math,
  MathBlock,
  MindMap,
  RingAISynapseFlow,
  Timeline,
} from '@/components/docs/mdx-heavy-components'
import { collectDiagramSource } from '@/components/docs/diagram-source'

export const docsMdxComponents = {
  Callout,
  Steps,
  Step,
  Tabs,
  Tab,
  Card,
  Cards,
  UiCard,
  UiCardHeader,
  UiCardTitle,
  UiCardDescription,
  UiCardContent,
  Mermaid,
  MindMap,
  Code,
  RingAISynapseFlow,
  Timeline,
  Math,
  MathBlock,
  CodeSandbox,
  h1: ({ children, ...props }: React.ComponentProps<'h1'>) => (
    <h1
      className="text-4xl font-bold tracking-tight mb-6 mt-8 first:mt-0 text-foreground scroll-mt-20"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: React.ComponentProps<'h2'>) => (
    <h2
      className="text-3xl font-semibold tracking-tight mb-4 mt-10 first:mt-0 pb-2 border-b border-border text-foreground scroll-mt-20"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: React.ComponentProps<'h3'>) => (
    <h3 className="text-2xl font-semibold mb-3 mt-8 text-foreground scroll-mt-20" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }: React.ComponentProps<'h4'>) => (
    <h4 className="text-xl font-semibold mb-2 mt-6 text-foreground scroll-mt-20" {...props}>
      {children}
    </h4>
  ),
  h5: ({ children, ...props }: React.ComponentProps<'h5'>) => (
    <h5 className="text-lg font-semibold mb-2 mt-4 text-foreground scroll-mt-20" {...props}>
      {children}
    </h5>
  ),
  h6: ({ children, ...props }: React.ComponentProps<'h6'>) => (
    <h6 className="text-base font-semibold mb-2 mt-4 text-foreground scroll-mt-20" {...props}>
      {children}
    </h6>
  ),
  p: ({ children, ...props }: React.ComponentProps<'p'>) => (
    <p className="text-base leading-7 text-muted-foreground mb-4 [&:not(:first-child)]:mt-4" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }: React.ComponentProps<'ul'>) => (
    <ul className="my-4 ml-6 list-disc [&>li]:mt-2 text-muted-foreground" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: React.ComponentProps<'ol'>) => (
    <ol className="my-4 ml-6 list-decimal [&>li]:mt-2 text-muted-foreground" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }: React.ComponentProps<'li'>) => (
    <li className="leading-7" {...props}>
      {children}
    </li>
  ),
  table: ({ children, ...props }: React.ComponentProps<'table'>) => (
    <div className="my-6 w-full overflow-y-auto">
      <table className="w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }: React.ComponentProps<'thead'>) => (
    <thead className="border-b border-border" {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }: React.ComponentProps<'tbody'>) => (
    <tbody className="[&_tr:last-child]:border-0" {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, ...props }: React.ComponentProps<'tr'>) => (
    <tr className="border-b border-border transition-colors hover:bg-muted/50" {...props}>
      {children}
    </tr>
  ),
  th: ({ children, ...props }: React.ComponentProps<'th'>) => (
    <th className="h-12 px-4 text-left align-middle font-medium text-foreground" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }: React.ComponentProps<'td'>) => (
    <td className="p-4 align-middle text-muted-foreground" {...props}>
      {children}
    </td>
  ),
  img: ({ alt, ...props }: React.ComponentProps<'img'>) => (
    <Image className="rounded-lg border border-border my-6" alt={alt || ''} width={100} height={100} src={props.src as string} />
  ),
  pre: ({ children, ...props }: React.ComponentProps<'pre'>) => (
    <pre
      className="mb-4 mt-4 overflow-x-auto rounded-lg border border-border bg-muted p-4 font-mono text-sm"
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({ children, className, ...props }: React.ComponentProps<'code'>) => {
    const isInline = !className?.includes('language-')
    if (!isInline && typeof className === 'string' && className.includes('language-mermaid')) {
      const text = collectDiagramSource(children).trimEnd()
      return <Mermaid title="Diagram">{text}</Mermaid>
    }
    return isInline ? (
      <InlineCode {...props}>{children}</InlineCode>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    )
  },
  blockquote: ({ children, ...props }: React.ComponentProps<'blockquote'>) => (
    <blockquote className="mt-6 border-l-4 border-primary pl-6 italic text-muted-foreground [&>p]:text-muted-foreground" {...props}>
      {children}
    </blockquote>
  ),
  strong: ({ children, ...props }: React.ComponentProps<'strong'>) => (
    <strong className="font-semibold text-foreground" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }: React.ComponentProps<'em'>) => (
    <em className="italic" {...props}>
      {children}
    </em>
  ),
  a: ({ children, href, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} className="text-primary hover:underline font-medium" {...props}>
      {children}
    </a>
  ),
  hr: (props: React.ComponentProps<'hr'>) => <hr className="my-8 border-gray-200 dark:border-gray-800" {...props} />,
}

/** Widen plugin tuples for `MDXRemote` / `next-mdx-remote` typings. */
export function getDocsMdxRemoteOptions() {
  return {
    mdxOptions: {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [[rehypeMermaidFenceToMdx], [rehypeCodeFenceToMdx]] as any,
    },
  }
}
