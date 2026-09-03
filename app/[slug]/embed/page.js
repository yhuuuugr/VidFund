import { getCampaignForMeta } from '../opengraph-image-helper';
import { notFound } from 'next/navigation';

// This page exists purely so social platforms have an iframe-able URL to
// point their video-preview embeds at (X/Twitter's "player card" requires
// twitter:player to be a page, not a raw video file). It's intentionally
// bare: no nav, no donate flow, just the video filling the frame so it
// looks like a native inline video when embedded elsewhere.
export default async function CampaignEmbed({ params }) {
  const result = await getCampaignForMeta(params.slug);
  if (!result || !result.campaign.video_url) notFound();

  const { campaign } = result;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <video
        src={campaign.video_url}
        poster={campaign.cover_image_url || undefined}
        controls
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
    </div>
  );
}
