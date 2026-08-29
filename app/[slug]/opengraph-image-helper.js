// Helper used by app/[slug]/page.js's generateMetadata to build
// dynamic Open Graph tags so WhatsApp/Facebook previews show the
// video thumbnail, title, and amount raised.
//
// Uses the public (anon) client rather than the admin client — campaign
// data is meant to be publicly readable anyway (there's an RLS policy
// for it), and using the admin client here meant a misconfigured
// SUPABASE_SERVICE_ROLE_KEY would silently turn every campaign page into
// a blank 404 with no error surfaced anywhere.
import { supabase } from '../../lib/supabaseClient';

export async function getCampaignForMeta(slug) {
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('slug', slug)
    .single();

  if (campaignError) {
    console.error(`Failed to load campaign "${slug}":`, campaignError.message);
  }
  if (!campaign) return null;

  const { data: totals, error: totalsError } = await supabase
    .from('campaign_totals')
    .select('*')
    .eq('slug', slug)
    .single();

  if (totalsError) {
    console.error(`Failed to load totals for "${slug}":`, totalsError.message);
  }

  return { campaign, totals: totals || null };
}
