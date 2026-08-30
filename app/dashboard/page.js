'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const PLATFORM_FEE_PERCENT = 0.05; // keep in sync with .env PLATFORM_FEE_PERCENT
const ADMIN_EMAIL = 'edwinafriyie16@gmail.com';

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Dashboard() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out
  const [authEmail, setAuthEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');

  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => listener.subscription.unsubscribe();
  }, []);

  const isAdmin = session?.user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (isAdmin) loadCampaigns();
  }, [isAdmin]);

  async function handleSendMagicLink(e) {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: authEmail,
        options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.href : undefined },
      });
      if (error) throw error;
      setOtpSent(true);
    } catch (err) {
      setAuthError(err.message || 'Could not send sign-in link.');
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function loadCampaigns() {
    setLoading(true);
    const { data } = await supabase
      .from('campaign_totals')
      .select('*, campaigns(creator_name, creator_momo_number, title, withdrawal_requested_at)')
      .order('unpaid_balance', { ascending: false });

    // Requested-and-unpaid first, then by balance — so the ones actually
    // waiting on you surface at the top instead of getting lost in the sort.
    const sorted = (data || []).sort((a, b) => {
      const aRequested = a.campaigns?.withdrawal_requested_at ? 1 : 0;
      const bRequested = b.campaigns?.withdrawal_requested_at ? 1 : 0;
      if (aRequested !== bRequested) return bRequested - aRequested;
      return Number(b.unpaid_balance || 0) - Number(a.unpaid_balance || 0);
    });

    setCampaigns(sorted);
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

    // Clear the request flag now that it's been handled
    await supabase
      .from('campaigns')
      .update({ withdrawal_requested_at: null })
      .eq('id', campaignId);

    loadCampaigns();
  }

  // --- Auth gates ---
  if (session === undefined) {
    return <main style={{ padding: 20, fontFamily: 'system-ui, sans-serif' }}><p>Loading…</p></main>;
  }

  if (session === null) {
    return (
      <main style={{ maxWidth: 420, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 22 }}>Admin sign in</h1>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>This page is restricted.</p>
        {!otpSent ? (
          <form onSubmit={handleSendMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 15 }}
            />
            {authError && <p style={{ color: '#c0392b', fontSize: 14, margin: 0 }}>{authError}</p>}
            <button
              type="submit"
              disabled={authSubmitting}
              style={{ padding: '12px', borderRadius: 8, border: 'none', background: '#1a7d3c', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              {authSubmitting ? 'Sending…' : 'Send me a sign-in link'}
            </button>
          </form>
        ) : (
          <p style={{ fontSize: 14, color: '#2a6b2a' }}>Check <strong>{authEmail}</strong> for a sign-in link.</p>
        )}
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main style={{ maxWidth: 420, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
        <h1 style={{ fontSize: 22 }}>Access denied</h1>
        <p style={{ color: '#666', fontSize: 14 }}>
          Signed in as {session.user.email}. This page is restricted to the admin account.
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{ marginTop: 12, background: 'none', border: 'none', color: '#1a7d3c', fontWeight: 700, cursor: 'pointer' }}
        >
          Sign out
        </button>
      </main>
    );
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
            <th style={th}>Status</th>
            <th style={th}>Unpaid balance</th>
            <th style={th}>You send (after fee)</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => {
            const unpaid = Number(c.unpaid_balance || 0);
            const toSend = unpaid * (1 - PLATFORM_FEE_PERCENT);
            const requestedAt = c.campaigns?.withdrawal_requested_at;
            return (
              <tr key={c.campaign_id} style={{ borderBottom: '1px solid #f0f0f0', background: requestedAt ? '#fff9ec' : 'transparent' }}>
                <td style={td}>{c.campaigns?.title}</td>
                <td style={td}>{c.campaigns?.creator_name}</td>
                <td style={td}>{c.campaigns?.creator_momo_number}</td>
                <td style={td}>
                  {requestedAt ? (
                    <span style={{ color: '#8a5a10', fontWeight: 700, fontSize: 12.5 }}>
                      Requested {timeAgo(requestedAt)}
                    </span>
                  ) : unpaid > 0 ? (
                    <span style={{ color: '#999', fontSize: 12.5 }}>Not requested</span>
                  ) : (
                    <span style={{ color: '#ccc', fontSize: 12.5 }}>—</span>
                  )}
                </td>
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
