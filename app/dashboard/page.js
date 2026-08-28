'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const PLATFORM_FEE_PERCENT = 0.05; // keep in sync with .env PLATFORM_FEE_PERCENT

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function loadCampaigns() {
    setLoading(true);
    const { data } = await supabase
      .from('campaign_totals')
      .select('*, campaigns(creator_name, creator_momo_number, title)')
      .order('unpaid_balance', { ascending: false });
    setCampaigns(data || []);
    setLoading(false);
  }

  async function markPaidOut(campaignId, unpaidBalance) {
    const platformCut = unpaidBalance * PLATFORM_FEE_PERCENT;
    const payoutAmount = unpaidBalance - platformCut;

    const confirmed = confirm(
      `Mark ₵${payoutAmount.toFixed(2)} as paid to this creator (after ₵${platformCut.toFixed(2)} platform fee)?`
    );
    if (!confirmed) return;

    await supabase.from('payouts').insert({
      campaign_id: campaignId,
      amount: payoutAmount,
      momo_number: '', // filled from campaign record server-side if you extend this
      paid_by: 'you',
    });

    await supabase
      .from('donations')
      .update({ payout_status: 'paid' })
      .eq('campaign_id', campaignId)
      .eq('status', 'success')
      .eq('payout_status', 'unpaid');

    loadCampaigns();
  }

  if (loading) return <p style={{ padding: 20 }}>Loading…</p>;

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Payout dashboard</h1>
      <p style={{ color: '#666' }}>Platform fee: {(PLATFORM_FEE_PERCENT * 100).toFixed(0)}% per donation</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
            <th style={th}>Campaign</th>
            <th style={th}>Creator</th>
            <th style={th}>MoMo</th>
            <th style={th}>Unpaid balance</th>
            <th style={th}>You send (after fee)</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => {
            const unpaid = Number(c.unpaid_balance || 0);
            const toSend = unpaid * (1 - PLATFORM_FEE_PERCENT);
            return (
              <tr key={c.campaign_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={td}>{c.campaigns?.title}</td>
                <td style={td}>{c.campaigns?.creator_name}</td>
                <td style={td}>{c.campaigns?.creator_momo_number}</td>
                <td style={td}>₵{unpaid.toFixed(2)}</td>
                <td style={td}>₵{toSend.toFixed(2)}</td>
                <td style={td}>
                  {unpaid > 0 && (
                    <button
                      onClick={() => markPaidOut(c.campaign_id, unpaid)}
                      style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#1a7d3c', color: '#fff', cursor: 'pointer' }}
                    >
                      Mark paid
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}

const th = { padding: '8px 6px', fontSize: 13, color: '#666' };
const td = { padding: '10px 6px', fontSize: 14 };
