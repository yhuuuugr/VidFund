import { supabase } from '../lib/supabaseClient';

// Update this if vidfund.site isn't your final production domain.
const BASE_URL = 'https://vidfund.site';

export default async function sitemap() {
  const staticRoutes = [
    {
      url: `${BASE_URL}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/create`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // Pull active campaigns so each fundraiser page gets indexed too.
  let campaignRoutes = [];
  try {
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('slug, created_at')
      .eq('status', 'active');

    if (!error && campaigns) {
      campaignRoutes = campaigns.map((campaign) => ({
        url: `${BASE_URL}/${campaign.slug}`,
        lastModified: campaign.created_at
          ? new Date(campaign.created_at)
          : new Date(),
        changeFrequency: 'daily',
        priority: 0.7,
      }));
    }
  } catch (err) {
    // If Supabase isn't reachable at build time, fall back to static routes only.
    console.error('sitemap: failed to fetch campaigns', err);
  }

  return [...staticRoutes, ...campaignRoutes];
}
