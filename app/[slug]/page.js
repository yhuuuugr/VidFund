import { getCampaignForMeta } from './opengraph-image-helper';
import CampaignClient from './CampaignClient';
import { notFound } from 'next/navigation';

export async function generateMetadata({ params }) {
  const result = await getCampaignForMeta(params.slug);
  if (!result) return {};

  const { campaign, totals } = result;
  const raised = totals?.total_raised || 0;

  return {
    title: `${campaign.title} — ₵${raised.toLocaleString()} raised`,
    description: campaign.story.slice(0, 150),
    openGraph: {
      title: campaign.title,
      description: `₵${raised.toLocaleString()} raised so far. Help push it further.`,
      images: campaign.cover_image_url ? [campaign.cover_image_url] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: campaign.title,
      description: `₵${raised.toLocaleString()} raised so far.`,
    },
  };
}

export default async function CampaignPage({ params }) {
  const result = await getCampaignForMeta(params.slug);
  if (!result) notFound();

  return <CampaignClient campaign={result.campaign} totals={result.totals} />;
}
