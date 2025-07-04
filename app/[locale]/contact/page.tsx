import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { Card, CardContent } from "@/components/ui/card"
import { Typography } from "@/components/ui/typography"
import Image from 'next/image'
import { ContactForm } from '@/components/widgets/contact-form'
import { getServerAuthSession } from "@/auth"
import { ROUTES } from '@/constants/routes'
import { LocalePageProps } from "@/utils/page-props"
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, Locale } from '@/utils/i18n-server'

export const dynamic = 'force-dynamic'

type ContactPageParams = {}

/**
 * Renders the contact page with a contact form, contact information, FAQs, and partner logos.
 * 
 * User steps:
 * 1. User navigates to the contact page
 * 2. The page authenticates the user
 * 3. If authenticated, the user sees the contact form, information, FAQs, and partner logos
 * 4. User can fill out and submit the contact form
 * 5. User can view contact information, FAQs, and partner logos
 * 
 * @param props - The page properties including params and searchParams as Promises.
 * @returns JSX.Element - The rendered page content.
 */
export default async function ContactPage(props: LocalePageProps<ContactPageParams>) {
  console.log('ContactPage: Starting');

  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  console.log('ContactPage: Using locale', locale);

  // Load translations for the current locale (for React 19 metadata)
  const translations = loadTranslations(locale);
  
  // React 19 metadata preparation
  const title = (translations as any).metadata?.contact || 'Contact Us - Ring App';
  const description = (translations as any).metaDescription?.contact || 'Get in touch with the Ring App team. Contact us for partnerships, opportunities, and collaboration in the Cherkasy tech ecosystem.';
  const canonicalUrl = `https://ring.ck.ua/${locale}/contact`;
  const alternates = generateHreflangAlternates('/contact');

  // Authenticate user session
  console.log('ContactPage: Authenticating session');
  const session = await getServerAuthSession()
  console.log('ContactPage: Session authenticated', { 
    sessionExists: !!session, 
    userId: session?.user?.id,
  });

  // Get cookies and headers
  const cookieStore = await cookies()
  const headersList = await headers()
  const token = cookieStore.get("token");
  const userAgent = headersList.get('user-agent')

  console.log('ContactPage: Request details', {
    params,
    searchParams,
    locale,
    userAgent,
    hasToken: !!token
  });

  // Redirect to login if no session
  if (!session) {
    console.log('ContactPage: No session, redirecting to login');
    redirect(ROUTES.LOGIN(locale))
  }

  // Partner logos
  const partners = [
    { name: 'Partner 1', logo: '/placeholder.svg?height=100&width=200' },
    { name: 'Partner 2', logo: '/placeholder.svg?height=100&width=200' },
    { name: 'Partner 3', logo: '/placeholder.svg?height=100&width=200' },
    { name: 'Partner 4', logo: '/placeholder.svg?height=100&width=200' },
    { name: 'Partner 5', logo: '/placeholder.svg?height=100&width=200' },
  ]

  console.log('ContactPage: Rendering');

  return (
    <>
      {/* React 19 Native Document Metadata */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={locale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:alternate_locale" content={locale === 'uk' ? 'en_US' : 'uk_UA'} />
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      
      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url} />
      ))}

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Typography variant="h1" className="text-4xl font-bold mb-12 text-center text-primary">
          {(translations as any).contact?.title || 'Contact Us'}
        </Typography>
        
        <Card className="mb-12">
          <CardContent className="pt-6">
            <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
              {(translations as any).contact?.getInTouch || 'Get in Touch'}
            </Typography>
            <Typography variant="p" className="mb-6 text-muted-foreground">
              {(translations as any).contact?.description || "We'd love to hear from you. Please fill out the form below and we'll get back to you as soon as possible."}
            </Typography>
            <Suspense fallback={<div>{(translations as any).contact?.loadingForm || 'Loading contact form...'}</div>}>
              <ContactForm 
                entityId="contact_page" 
                entityName="Contact Page" 
                initialUserInfo={{
                  name: session.user.name || '',
                  email: session.user.email || ''
                }}
              />
            </Suspense>
          </CardContent>
        </Card>

        <Card className="mb-12">
          <CardContent className="pt-6">
            <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
              {(translations as any).contact?.contactInformation || 'Contact Information'}
            </Typography>
            <Typography variant="p" className="mb-2 text-muted-foreground">
              195 Shevhenko Blvd, Cherkasy, Ukraine
            </Typography>
            <Typography variant="p" className="mb-2 text-muted-foreground">
              Phone: +38 097 5328801
            </Typography>
            <Typography variant="p" className="mb-6 text-muted-foreground">
              Email: contact@ring.ck.ua
            </Typography>
          </CardContent>
        </Card>

        <Card className="mb-12">
          <CardContent className="pt-6">
            <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
              {(translations as any).contact?.faq || 'Frequently Asked Questions'}
            </Typography>
            <div className="space-y-4">
              <div>
                <Typography variant="h3" className="text-lg font-semibold mb-2 text-primary">
                  {(translations as any).contact?.faqJoin || 'How can I join Ring?'}
                </Typography>
                <Typography variant="p" className="text-muted-foreground">
                  {(translations as any).contact?.faqJoinAnswer || 'You can join Ring by registering on our platform. Once registered, you can create a profile for your organization and start connecting with others in the tech ecosystem.'}
                </Typography>
              </div>
              <div>
                <Typography variant="h3" className="text-lg font-semibold mb-2 text-primary">
                  {(translations as any).contact?.faqOpportunities || 'What kind of opportunities can I find on Ring?'}
                </Typography>
                <Typography variant="p" className="text-muted-foreground">
                  {(translations as any).contact?.faqOpportunitiesAnswer || 'Ring offers a wide range of opportunities including job postings, partnership proposals, investment opportunities, and collaboration requests within the tech industry.'}
                </Typography>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-12">
          <CardContent className="pt-6">
            <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
              {(translations as any).contact?.partners || 'Our Partners'}
            </Typography>
            <div className="overflow-x-auto">
              <div className="flex space-x-6 pb-4">
                {partners.map((partner, index) => (
                  <div key={index} className="flex-shrink-0">
                    <Image
                      src={partner.logo || "/placeholder.svg"}
                      alt={partner.name}
                      width={200}
                      height={100}
                      className="object-contain"
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

/* 
 * OBSOLETE FUNCTIONS (removed with React 19 migration):
 * - generateMetadata() function (replaced by React 19 native document metadata)
 * 
 * React 19 Native Features Used:
 * - Document metadata: <title>, <meta>, <link> tags automatically hoisted to <head>
 * - Automatic meta tag deduplication and precedence handling
 * - Native hreflang support for i18n
 */