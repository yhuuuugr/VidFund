import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

const ADMIN_EMAIL = 'edwinafriyie16@gmail.com';
const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT ?? 0.05);

export async function POST(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Same guard as process-report: this endpoint moves the record of who got
  // paid what, so it must never trust the client alone.
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || userData?.user?.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { campaign_id } = await req.json();
  if (!campaign_id) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from('campaigns')
    .select('id, creator_momo_number, fraud_flagged')
    .eq('id', campaign_id)
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  if (campaign.fraud_flagged) {
    return NextResponse.json({ error: 'Campaign is fraud-flagged; payout blocked' }, { status: 409 });
  }

  // Recompute the unpaid balance server-side rather than trusting a client-sent
  // amount — donations could have changed between page load and click.
  const { data: unpaidDonations, error: donationsError } = await supabaseAdmin
    .from('donations')
    .select('id, amount')
    .eq('campaign_id', campaign_id)
    .eq('status', 'success')
    .eq('payout_status', 'unpaid');

  if (donationsError) {
    return NextResponse.json({ error: donationsError.message }, { status: 500 });
  }

  const unpaidBalance = (unpaidDonations || []).reduce((sum, d) => sum + Number(d.amount), 0);
  const donationIds = (unpaidDonations || []).map((d) => d.id);

  if (unpaidBalance <= 0 || donationIds.length === 0) {
    return NextResponse.json({ error: 'Nothing unpaid for this campaign' }, { status: 400 });
  }

  const platformCut = unpaidBalance * PLATFORM_FEE_PERCENT;
  const payoutAmount = unpaidBalance - platformCut;

  const { error: payoutError } = await supabaseAdmin.from('payouts').insert({
    campaign_id,
    amount: payoutAmount,
    momo_number: campaign.creator_momo_number,
    paid_by: userData.user.email,
  });

  if (payoutError) {
    return NextResponse.json({ error: payoutError.message }, { status: 500 });
  }

  // Update only the exact donations we counted above (by id) — not "whatever
  // is still unpaid right now" — so a donation that succeeds in the gap
  // between the select and this update can't get marked paid without its
  // amount ever having been included in the payout.
  const { error: updateDonationsError } = await supabaseAdmin
    .from('donations')
    .update({ payout_status: 'paid' })
    .in('id', donationIds)
    .eq('payout_status', 'unpaid');

  if (updateDonationsError) {
    return NextResponse.json({ error: updateDonationsError.message }, { status: 500 });
  }

  const { error: updateCampaignError } = await supabaseAdmin
    .from('campaigns')
    .update({ withdrawal_requested_at: null })
    .eq('id', campaign_id);

  if (updateCampaignError) {
    return NextResponse.json({ error: updateCampaignError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    amount_paid: payoutAmount,
    momo_number: campaign.creator_momo_number,
  });
}
