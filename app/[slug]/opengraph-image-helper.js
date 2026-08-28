// Helper used by app/[slug]/page.js's generateMetadata to build
// dynamic Open Graph tags so WhatsApp/Facebook previews show the
// video thumbnail, title, and amount raised.
import { supabaseAdmin } from '../../lib/supabaseAdmin';

export async function getCampaignForMeta(slug) {
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!campaign) return null;

  const { data: totals } = await supabaseAdmin
    .from('campaign_totals')
    .select('*')
    .eq('slug', slug)
    .single();

  return { campaign, totals };
}
