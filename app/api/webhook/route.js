import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

// Paystack calls this directly. Useful as a backup: if a donor closes their
// browser right after paying (before the client-side callback fires), this
// webhook still records the donation so nobody's payment gets lost.
export async function POST(req) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature');

  const expectedSignature = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === 'charge.success') {
    const { reference, amount, metadata } = event.data;
    const amountGHS = amount / 100;
    const campaignId = metadata?.campaign_id;

    if (campaignId) {
      const { data: campaign } = await supabaseAdmin
        .from('campaigns')
        .select('suggested_amount')
        .eq('id', campaignId)
        .single();

      if (campaign) {
        const units = amountGHS / Number(campaign.suggested_amount);

        // Insert if it doesn't already exist (client-side confirm may have beaten us to it)
        await supabaseAdmin.from('donations').upsert(
          {
            campaign_id: campaignId,
            amount: amountGHS,
            units,
            donor_name: metadata?.donor_name || null,
            paystack_reference: reference,
            status: 'success',
          },
          { onConflict: 'paystack_reference', ignoreDuplicates: true }
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}
