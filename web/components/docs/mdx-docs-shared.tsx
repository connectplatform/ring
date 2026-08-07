/**
 * Shared MDX component map + serialization options for Ring docs (library index + slug pages).
 *
 * - remark-gfm: GFM tables, strikethrough, task lists, autolinks (not provided by remark-mdx alone).
 * - Tables: custom `table`/`th`/`td` map (no @tailwindcss/typography). Wrapper MUST be
 *   `overflow-x-auto` — docs shell uses `overflow-hidden`; `overflow-y-auto` clipped wide tables.
 * - Mermaid / MindMap / RingAISynapseFlow: MDX JSX components — not remark plugins; expose them here so
 *   `docs/{locale}/index.mdx` can use the same blocks as deeper pages.
 * - Fenced code: `rehypeCodeFenceToMdx` → async `<Code>` → server Shiki (`highlightCodeToHtml`).
 */
import React from 'react'
import Image from 'next/image'
import remarkGfm from 'remark-gfm'
import { rehypeMermaidFenceToMdx } from '@/components/docs/rehype-mermaid-fence'
import { rehypeCodeFenceToMdx } from '@/components/docs/rehype-code-fence-to-mdx'
import { remarkMermaidJsxSource } from '@/components/docs/remark-mermaid-jsx-source'
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
import { RelatedArticle, RelatedDocs } from '@/components/docs/related-article'
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
  RingMatcherOrchestration,
  RingGatewayBridge,
  RingPaymentConductorFlow,
  RingWidgetFlowStepsFive,  RingCollectiveIntelligenceLoop,
  RingDeploymentPaths,
  RingFeatureEcosystem,
  RingProblemSolvingEvolution,
  RingHumanityVision,
  Timeline,
  RingWidgetsContact,
  RingIntegrationPlanesHub,
  RingApiTree,
  RingWelcomeFeatureExplorer,
  NftWidgetItem,
  FutureFeatureWidget,
  FutureFeatureBacklog,
} from '@/components/docs/mdx-heavy-components'
import { collectDiagramSource } from '@/components/docs/diagram-source'
import { Audience } from '@/components/ui/audience-block'
import { markdownProseClasses } from '@/lib/docs/markdown-prose-classes'

export const docsMdxComponents = {
  Audience,
  Callout,
  Steps,
  Step,
  Tabs,
  Tab,
  Card,
  Cards,
  RelatedArticle,
  RelatedDocs,
  UiCard,
  UiCardHeader,
  UiCardTitle,
  UiCardDescription,
  UiCardContent,
  Mermaid,
  MindMap,
  Code,
  RingAISynapseFlow,
  RingMatcherOrchestration,
  RingGatewayBridge,
  RingPaymentConductorFlow,
  RingCollectiveIntelligenceLoop,
  RingWidgetFlowStepsFive,  RingDeploymentPaths,
  RingFeatureEcosystem,
  RingProblemSolvingEvolution,
  RingHumanityVision,
  Timeline,
  Math,
  MathBlock,
  CodeSandbox,
  RingWidgetsContact,
  RingIntegrationPlanesHub,
  RingApiTree,
  RingWelcomeFeatureExplorer,
  NftWidgetItem,
  FutureFeatureWidget,
  FutureFeatureBacklog,
  h1: ({ children, ...props }: React.ComponentProps<'h1'>) => (
    <h1 className={markdownProseClasses.h1} {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: React.ComponentProps<'h2'>) => (
    <h2 className={markdownProseClasses.h2} {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: React.ComponentProps<'h3'>) => (
    <h3 className={markdownProseClasses.h3} {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }: React.ComponentProps<'h4'>) => (
    <h4 className={markdownProseClasses.h4} {...props}>
      {children}
    </h4>
  ),
  h5: ({ children, ...props }: React.ComponentProps<'h5'>) => (
    <h5 className={markdownProseClasses.h5} {...props}>
      {children}
    </h5>
  ),
  h6: ({ children, ...props }: React.ComponentProps<'h6'>) => (
    <h6 className={markdownProseClasses.h6} {...props}>
      {children}
    </h6>
  ),
  p: ({ children, ...props }: React.ComponentProps<'p'>) => (
    <p className={markdownProseClasses.p} {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }: React.ComponentProps<'ul'>) => (
    <ul className={markdownProseClasses.ul} {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: React.ComponentProps<'ol'>) => (
    <ol className={markdownProseClasses.ol} {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }: React.ComponentProps<'li'>) => (
    <li className={markdownProseClasses.li} {...props}>
      {children}
    </li>
  ),
  table: ({ children, ...props }: React.ComponentProps<'table'>) => (
    // Parent docs panel uses overflow-hidden + min-w-0; must scroll on X (not Y)
    // or wide GFM tables clip with no scrollbar — same “invisible table” symptom
    // as wiki prose without typography (structure present, presentation broken).
    <div className={markdownProseClasses.tableWrap}>
      <table className={markdownProseClasses.table} {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }: React.ComponentProps<'thead'>) => (
    <thead className={markdownProseClasses.thead} {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }: React.ComponentProps<'tbody'>) => (
    <tbody className={markdownProseClasses.tbody} {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, ...props }: React.ComponentProps<'tr'>) => (
    <tr className={markdownProseClasses.tr} {...props}>
      {children}
    </tr>
  ),
  th: ({ children, ...props }: React.ComponentProps<'th'>) => (
    <th className={markdownProseClasses.th} {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }: React.ComponentProps<'td'>) => (
    <td className={markdownProseClasses.td} {...props}>
      {children}
    </td>
  ),
  img: ({ alt, ...props }: React.ComponentProps<'img'>) => (
    <Image className="rounded-lg border border-border my-6" alt={alt || ''} width={100} height={100} src={props.src as string} />
  ),
  pre: ({ children, ...props }: React.ComponentProps<'pre'>) => (
    <pre className={markdownProseClasses.pre} {...props}>
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
    <blockquote className={markdownProseClasses.blockquote} {...props}>
      {children}
    </blockquote>
  ),
  strong: ({ children, ...props }: React.ComponentProps<'strong'>) => (
    <strong className={markdownProseClasses.strong} {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }: React.ComponentProps<'em'>) => (
    <em className={markdownProseClasses.em} {...props}>
      {children}
    </em>
  ),
  a: ({ children, href, ...props }: React.ComponentProps<'a'>) => {
    const external = typeof href === 'string' && /^https?:\/\//.test(href)
    return (
      <a
        href={href}
        className={markdownProseClasses.a}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        {...props}
      >
        {children}
      </a>
    )
  },
  hr: (props: React.ComponentProps<'hr'>) => <hr className={markdownProseClasses.hr} {...props} />,
}

/** Widen plugin tuples for `MDXRemote` / `next-mdx-remote` typings. */
export function getDocsMdxRemoteOptions() {
  return {
    mdxOptions: {
      remarkPlugins: [remarkGfm, remarkMermaidJsxSource],
      rehypePlugins: [[rehypeMermaidFenceToMdx], [rehypeCodeFenceToMdx]] as any,
    },
  }
}
