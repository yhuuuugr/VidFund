import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

// Verifies the transaction directly with Paystack's API before recording it —
// never trust the amount/status coming from the browser callback alone.
export async function POST(req) {
  const body = await req.json();
  const { reference, campaign_id, donor_name } = body;

  if (!reference || !campaign_id) {
    return NextResponse.json({ error: 'Missing reference or campaign_id' }, { status: 400 });
  }

  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  });
  const verifyData = await verifyRes.json();

  if (!verifyData.status || verifyData.data.status !== 'success') {
    return NextResponse.json({ error: 'Payment not verified' }, { status: 400 });
  }

  // Trust only the campaign_id Paystack recorded at charge time (from its own
  // metadata), not whatever campaign_id the browser sends here — otherwise a
  // donor could pay for one campaign and attribute the money to another.
  const verifiedCampaignId = verifyData.data.metadata?.campaign_id;
  if (verifiedCampaignId && verifiedCampaignId !== campaign_id) {
    return NextResponse.json({ error: 'Campaign mismatch for this payment' }, { status: 400 });
  }

  const amountGHS = verifyData.data.amount / 100;

  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('suggested_amount')
    .eq('id', campaign_id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const units = amountGHS / Number(campaign.suggested_amount);

  const { error: insertError } = await supabaseAdmin.from('donations').insert({
    campaign_id,
    amount: amountGHS,
    units,
    donor_name: donor_name || null,
    paystack_reference: reference,
    status: 'success',
  });

  if (insertError) {
    // Likely a duplicate reference (donor double-submitted) — treat as already recorded
    if (insertError.code === '23505') {
      return NextResponse.json({ ok: true, note: 'already recorded' });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
