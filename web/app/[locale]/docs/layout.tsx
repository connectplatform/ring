import DocsLayoutShell from '@/components/docs/docs-layout-shell'

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  return <DocsLayoutShell locale={locale}>{children}</DocsLayoutShell>
}
