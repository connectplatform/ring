import { Metadata } from 'next';
import { buildMessages } from '@/lib/i18n';
import { DeploymentCalculator } from '@/components/tools/deployment-calculator';

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const { locale } = await params;
  const messages = await buildMessages(locale);
  const t = messages['deployment-calculator'] || {};

  return {
    title: t.title || 'Ring Platform Deployment Calculator',
    description: t.description || 'Calculate your deployment time, costs, and get a customized roadmap for launching your Ring platform',
    keywords: ['Ring Platform', 'deployment calculator', 'platform setup', 'cost estimation'],
  };
}

export default function DeploymentCalculatorPage() {
  return (
    <div className="min-h-screen bg-background lg:ml-72 xl:ml-72">
      <DeploymentCalculator />
    </div>
  );
}
