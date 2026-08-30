import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

const ADMIN_EMAIL = 'edwinafriyie16@gmail.com';

export async function POST(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Verify the caller is actually signed in as the admin — this endpoint
  // moves money and removes campaigns, so it must never trust the client alone.
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || userData?.user?.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { report_id, action } = await req.json();
  if (!report_id || !['dismiss', 'confirm_fraud'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { data: report, error: reportError } = await supabaseAdmin
    .from('reports')
    .select('*')
    .eq('id', report_id)
    .single();

  if (reportError || !report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  if (action === 'dismiss') {
    await supabaseAdmin
      .from('reports')
      .update({ status: 'dismissed', reviewed_at: new Date().toISOString() })
      .eq('id', report_id);
    return NextResponse.json({ ok: true, action: 'dismissed' });
  }

  // --- confirm_fraud: block the campaign and refund 50% of every donation ---

  const campaignId = report.campaign_id;

  await supabaseAdmin
    .from('campaigns')
    .update({
      status: 'removed',
      fraud_flagged: true,
      fraud_flagged_at: new Date().toISOString(),
      withdrawal_requested_at: null, // creator gets nothing — block any pending payout
    })
    .eq('id', campaignId);

  const { data: donations } = await supabaseAdmin
    .from('donations')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'success')
    .eq('refund_status', 'none');

  let refundedCount = 0;
  const failures = [];

  for (const donation of donations || []) {
    const refundAmountPesewas = Math.round((Number(donation.amount) * 100) / 2);

    try {
      const res = await fetch('https://api.paystack.co/refund', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction: donation.paystack_reference,
          amount: refundAmountPesewas,
        }),
      });
      const result = await res.json();

      if (result.status) {
        await supabaseAdmin
          .from('donations')
          .update({ refund_status: 'refunded', refunded_amount: refundAmountPesewas / 100 })
          .eq('id', donation.id);
        refundedCount++;
      } else {
        failures.push({ donation_id: donation.id, error: result.message });
      }
    } catch (err) {
      failures.push({ donation_id: donation.id, error: err.message });
    }
  }

  await supabaseAdmin
    .from('reports')
    .update({ status: 'confirmed_fraud', reviewed_at: new Date().toISOString() })
    .eq('id', report_id);

  return NextResponse.json({
    ok: true,
    action: 'confirmed_fraud',
    total_donations: (donations || []).length,
    refunded_count: refundedCount,
    failures,
  });
}
