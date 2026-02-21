import { MDXRemote } from 'next-mdx-remote/rsc'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { isValidLocale, defaultLocale } from '@/i18n-config'
import { Callout } from '@/components/docs/callout'
import { Steps, Step } from '@/components/docs/steps'
import { Mermaid } from '@/components/docs/mermaid'

// Route segment configuration for docs hub page

interface PageProps {
  params: Promise<{
    locale: string
  }>
}

// Custom MDX components with proper heading styles
const mdxComponents = {
  // Headings with proper typography
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 
      className="text-4xl font-bold tracking-tight text-foreground mb-6 mt-8 first:mt-0 scroll-mt-20" 
      {...props} 
    />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 
      className="text-3xl font-semibold tracking-tight text-foreground mb-4 mt-10 first:mt-0 pb-2 border-b border-border scroll-mt-20" 
      {...props} 
    />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 
      className="text-2xl font-semibold text-foreground mb-3 mt-8 scroll-mt-20" 
      {...props} 
    />
  ),
  h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4 
      className="text-xl font-semibold text-foreground mb-2 mt-6 scroll-mt-20" 
      {...props} 
    />
  ),
  h5: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h5 
      className="text-lg font-semibold text-foreground mb-2 mt-4 scroll-mt-20" 
      {...props} 
    />
  ),
  h6: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h6 
      className="text-base font-semibold text-foreground mb-2 mt-4 scroll-mt-20" 
      {...props} 
    />
  ),
  
  // Paragraphs and text
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p 
      className="text-base leading-7 text-muted-foreground mb-4 [&:not(:first-child)]:mt-4" 
      {...props} 
    />
  ),
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  em: (props: React.HTMLAttributes<HTMLElement>) => (
    <em className="italic" {...props} />
  ),
  
  // Links
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a 
      className="font-medium text-primary underline underline-offset-4 hover:text-primary/80 transition-colors" 
      {...props} 
    />
  ),
  
  // Lists
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="my-4 ml-6 list-disc [&>li]:mt-2 text-muted-foreground" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="my-4 ml-6 list-decimal [&>li]:mt-2 text-muted-foreground" {...props} />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="leading-7" {...props} />
  ),
  
  // Code blocks
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code 
      className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm text-foreground" 
      {...props} 
    />
  ),
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre 
      className="mb-4 mt-4 overflow-x-auto rounded-lg border border-border bg-muted p-4 font-mono text-sm" 
      {...props} 
    />
  ),
  
  // Blockquote
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote 
      className="mt-6 border-l-4 border-primary pl-6 italic text-muted-foreground [&>p]:text-muted-foreground" 
      {...props} 
    />
  ),
  
  // Tables
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="my-6 w-full overflow-y-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="border-b border-border" {...props} />
  ),
  tbody: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <tbody className="[&_tr:last-child]:border-0" {...props} />
  ),
  tr: (props: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr className="border-b border-border transition-colors hover:bg-muted/50" {...props} />
  ),
  th: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th className="h-12 px-4 text-left align-middle font-medium text-foreground" {...props} />
  ),
  td: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td className="p-4 align-middle text-muted-foreground" {...props} />
  ),
  
  // Horizontal rule
  hr: () => <hr className="my-8 border-border" />,
  
  // Images
  img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="rounded-lg border border-border my-6" alt="" {...props} />
  ),
  
  // Custom components
  Callout,
  Steps,
  Step,
  Mermaid
}

// Server Component - can read files
export default async function DocsPage({ params }: PageProps) {
  const resolvedParams = await params
  const { locale: rawLocale } = resolvedParams
  const currentLocale = isValidLocale(rawLocale) ? rawLocale : defaultLocale

  // Read the library index.mdx file (Server-side)
  const filePath = path.join(process.cwd(), 'docs', 'content', currentLocale, 'library', 'index.mdx')

  let content = ''
  let frontmatter: Record<string, any> = {}

  try {
    if (fs.existsSync(filePath)) {
      const fileContents = fs.readFileSync(filePath, 'utf8')
      const { content: mdxContent, data } = matter(fileContents)
      content = mdxContent
      frontmatter = data
    }
  } catch (error) {
    console.error('Error reading docs content:', error)
  }

  // Fallback translations
  const fallbackTitle = currentLocale === 'uk' 
    ? '📖 Ласкаво просимо до GreenFood.live' 
    : '📖 Welcome to GreenFood.live'
  const fallbackDescription = currentLocale === 'uk' 
    ? 'Документація скоро буде доступна' 
    : 'Documentation coming soon'

  return (
    <div className="w-full h-full py-8 px-4 md:px-6 lg:px-8">
      <div className="w-full max-w-4xl mx-auto">
        {content ? (
          <MDXRemote
            source={content}
            components={mdxComponents}
            options={{
              mdxOptions: {
                remarkPlugins: [],
                rehypePlugins: []
              }
            }}
          />
        ) : (
          <div className="text-center py-12">
            <h1 className="text-4xl font-bold tracking-tight text-foreground mb-6">{fallbackTitle}</h1>
            <p className="text-muted-foreground">
              {fallbackDescription}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
