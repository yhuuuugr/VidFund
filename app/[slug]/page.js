import { getCampaignForMeta } from './opengraph-image-helper';
import CampaignClient from './CampaignClient';
import { notFound } from 'next/navigation';

// Trims to roughly `max` chars without cutting a word in half, so the
// preview reads as a real sentence instead of stopping mid-word.
function excerpt(text, max) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max)}…`;
}

// What shows under the title when the link is shared. Always prefers the
// creator's own words (that's what actually makes someone stop and tap) —
// the amount-raised framing is used only as a last resort, since every
// campaign requires a story at creation time and this should rarely fire.
function buildPreviewDescription(campaign, raised) {
  if (campaign.story && campaign.story.trim().length > 0) {
    return excerpt(campaign.story, 155);
  }
  const name = campaign.creator_name || 'This creator';
  return `${name} needs your help. Watch their story and support with any amount — it adds up fast.`;
}

export async function generateMetadata({ params }) {
  const result = await getCampaignForMeta(params.slug);
  if (!result) return {};

  const { campaign, totals } = result;
  const raised = totals?.total_raised || 0;
  const description = buildPreviewDescription(campaign, raised);
  const previewImage = campaign.cover_image_url || '/vidfund-og-fallback.png';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const embedUrl = `${siteUrl}/${campaign.slug}/embed`;

  return {
    title: `${campaign.title} — ₵${raised.toLocaleString()} raised`,
    description,
    openGraph: {
      title: campaign.title,
      description,
      images: [previewImage],
      type: campaign.video_url ? 'video.other' : 'website',
      // Where supported (Discord, Slack, some in-app browsers), this lets
      // the platform play the clip directly instead of just linking out.
      ...(campaign.video_url && {
        videos: [
          {
            url: campaign.video_url,
            secureUrl: campaign.video_url,
            type: 'video/mp4',
          },
        ],
      }),
    },
    twitter: campaign.video_url
      ? {
          // X's "player card" — shows a tap-to-play video right in the
          // timeline instead of a plain link. `player` must be an iframe-
          // able page (see app/[slug]/embed), `player:stream` is the raw
          // file for platforms that can play it without the iframe.
          card: 'player',
          title: campaign.title,
          description,
          images: [previewImage],
          players: [
            {
              playerUrl: embedUrl,
              streamUrl: campaign.video_url,
              width: 480,
              height: 852,
            },
          ],
        }
      : {
          card: 'summary_large_image',
          title: campaign.title,
          description,
          images: [previewImage],
        },
  };
}

export default async function CampaignPage({ params }) {
  const result = await getCampaignForMeta(params.slug);
  if (!result) notFound();

  return <CampaignClient campaign={result.campaign} totals={result.totals} />;
}
