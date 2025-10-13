import { Metadata } from 'next';
import { buildMessages } from '@/lib/i18n';
import { AboutTrinityClient } from './about-trinity-client';

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const { locale } = await params;
  const messages = await buildMessages(locale);
  const t = messages['about-trinity'] || {};

  return {
    title: t.title || 'Trinity Ukraine - Creators of Ring Platform',
    description: t.description || 'Built by Trinity Ukraine 🇺🇦 as our gift to the world during Ukraine\'s fight for independence. A free, self-modifying AI-orchestrated platform for collective problem solving.',
    keywords: ['Trinity Ukraine', 'Ring Platform', 'Open Source', 'AI', 'Web3', 'Collaboration'],
    openGraph: {
      title: t.title || 'Trinity Ukraine - Creators of Ring Platform',
      description: t.description || 'Built by Trinity Ukraine 🇺🇦 as our gift to the world during Ukraine\'s fight for independence. A free, self-modifying AI-orchestrated platform for collective problem solving.',
      type: 'website',
      images: [
        {
          url: '/og-trinity-ukraine.jpg',
          width: 1200,
          height: 630,
          alt: 'Trinity Ukraine - Creators of Ring Platform',
        },
      ],
    },
  };
}

export default function AboutTrinityPage() {
  return <AboutTrinityClient />;
}