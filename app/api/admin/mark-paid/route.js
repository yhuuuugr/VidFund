import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

const ADMIN_EMAIL = 'edwinafriyie16@gmail.com';
const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT ?? 0.05);

// Records a manual payout and clears the balance. This has to run server-side
// with the service role key — donations/payouts have no client write grants
// (see supabase/schema.sql), and campaigns' update policy only allows the
// owning creator, not the admin — so the browser can never do this itself.
export async function POST(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || userData?.user?.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { campaign_id } = await req.json();
  if (!campaign_id) {
    return NextResponse.json({ error: 'Missing campaign_id' }, { status: 400 });
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
    return NextResponse.json({ error: 'Campaign is fraud-flagged — payout blocked' }, { status: 400 });
  }

  // Recompute the unpaid balance server-side rather than trusting whatever
  // the browser last saw — it may be stale or tampered with.
  const { data: totals, error: totalsError } = await supabaseAdmin
    .from('campaign_totals')
    .select('unpaid_balance')
    .eq('campaign_id', campaign_id)
    .single();

  if (totalsError || !totals) {
    return NextResponse.json({ error: 'Could not load campaign totals' }, { status: 500 });
  }

  const unpaidBalance = Number(totals.unpaid_balance || 0);
  if (unpaidBalance <= 0) {
    return NextResponse.json({ error: 'Nothing unpaid for this campaign' }, { status: 400 });
  }

  const platformCut = unpaidBalance * PLATFORM_FEE_PERCENT;
  const payoutAmount = unpaidBalance - platformCut;

  const { error: payoutError } = await supabaseAdmin.from('payouts').insert({
    campaign_id,
    amount: payoutAmount,
    momo_number: campaign.creator_momo_number,
    paid_by: 'you',
  });

  if (payoutError) {
    return NextResponse.json({ error: payoutError.message }, { status: 500 });
  }

  const { error: donationsError } = await supabaseAdmin
    .from('donations')
    .update({ payout_status: 'paid' })
    .eq('campaign_id', campaign_id)
    .eq('status', 'success')
    .eq('payout_status', 'unpaid');

  if (donationsError) {
    return NextResponse.json({ error: donationsError.message }, { status: 500 });
  }

  await supabaseAdmin
    .from('campaigns')
    .update({ withdrawal_requested_at: null })
    .eq('id', campaign_id);

  return NextResponse.json({ ok: true, paid_amount: payoutAmount, platform_cut: platformCut });
}
