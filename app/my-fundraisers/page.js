'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import TopNav from '../../components/TopNav';

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function MyFundraisers() {
  const [session, setSession] = useState(undefined);
  const [authEmail, setAuthEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');

  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({}); // campaignId -> bool, show full supporter list

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadData();
  }, [session]);

  async function loadData() {
    setLoading(true);
    const { data: myCampaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('creator_email', session.user.email)
      .order('created_at', { ascending: false });

    if (!myCampaigns || myCampaigns.length === 0) {
      setCampaigns([]);
      setLoading(false);
      return;
    }

    const ids = myCampaigns.map((c) => c.id);

    const { data: totals } = await supabase.from('campaign_totals').select('*').in('campaign_id', ids);
    const { data: donations } = await supabase
      .from('donations')
      .select('*')
      .in('campaign_id', ids)
      .eq('status', 'success')
      .order('created_at', { ascending: false });

    const merged = myCampaigns.map((c) => ({
      ...c,
      totals: totals?.find((t) => t.campaign_id === c.id) || null,
      donations: donations?.filter((d) => d.campaign_id === c.id) || [],
    }));

    setCampaigns(merged);
    setLoading(false);
  }

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

  async function requestWithdrawal(campaignId) {
    const { error } = await supabase
      .from('campaigns')
      .update({ withdrawal_requested_at: new Date().toISOString() })
      .eq('id', campaignId);
    if (!error) loadData();
  }

  async function togglePause(campaignId, currentStatus) {
    const newStatus = currentStatus === 'paused' ? 'active' : 'paused';
    const { error } = await supabase.from('campaigns').update({ status: newStatus }).eq('id', campaignId);
    if (!error) loadData();
  }

  async function deleteCampaign(campaignId, title) {
    const confirmed = confirm(`Delete "${title}" permanently? This can't be undone.`);
    if (!confirmed) return;
    const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
    if (!error) loadData();
  }

  function copyLink(slug) {
    const url = `${window.location.origin}/${slug}`;
    navigator.clipboard.writeText(url);
  }

  // --- Auth gates ---
  if (session === undefined) {
    return (
      <>
        <TopNav />
        <main style={styles.page}><p style={styles.sub}>Loading…</p></main>
      </>
    );
  }

  if (session === null) {
    return (
      <>
        <TopNav />
        <main style={styles.page}>
          <h1 style={styles.h1}>Your fundraisers</h1>
          <p style={styles.sub}>Sign in with your email to see your dashboard.</p>

          {!otpSent ? (
            <form onSubmit={handleSendMagicLink} style={styles.form}>
              <input
                style={styles.input}
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
              {authError && <p style={styles.error}>{authError}</p>}
              <button style={styles.submitBtn} type="submit" disabled={authSubmitting}>
                {authSubmitting ? 'Sending…' : 'Send me a sign-in link'}
              </button>
            </form>
          ) : (
            <div style={styles.calcBox}>
              <p style={{ margin: 0, fontSize: 14, color: '#2a6b2a' }}>
                Check <strong>{authEmail}</strong> for a sign-in link.
              </p>
            </div>
          )}
        </main>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <TopNav />
        <main style={styles.page}><p style={styles.sub}>Loading your fundraisers…</p></main>
      </>
    );
  }

  if (campaigns.length === 0) {
    return (
      <>
        <TopNav />
        <main style={styles.page}>
          <h1 style={styles.h1}>Your fundraisers</h1>
          <p style={styles.sub}>You haven't started one yet.</p>
          <Link href="/create" style={styles.submitBtn}>Start a fundraiser</Link>
        </main>
      </>
    );
  }

  return (
    <>
      <TopNav />
      <main style={styles.page}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.h1}>Your fundraisers</h1>
            <p style={styles.sub}>Signed in as {session.user.email}</p>
          </div>
          <Link href="/create" style={styles.newBtn}>+ New</Link>
        </div>

      {campaigns.map((c) => {
        const raised = c.totals?.total_raised || 0;
        const supporters = Math.floor(c.totals?.total_units || 0);
        const unpaid = Number(c.totals?.unpaid_balance || 0);
        const goal = Number(c.suggested_amount) * c.target_units;
        const isExpanded = expanded[c.id];
        const visibleDonations = isExpanded ? c.donations : c.donations.slice(0, 3);

        return (
          <div key={c.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardTitle}>
                {c.title}
                {c.status === 'paused' && <span style={styles.pausedBadge}>Paused</span>}
              </div>
              <div style={styles.viewCount}>{c.view_count || 0} views</div>
            </div>

            <div style={styles.statsRow}>
              <div style={styles.stat}>
                <div style={styles.statValue}>₵{raised.toLocaleString()}</div>
                <div style={styles.statLabel}>raised of ₵{goal.toLocaleString()}</div>
              </div>
              <div style={styles.stat}>
                <div style={styles.statValue}>{supporters.toLocaleString()}</div>
                <div style={styles.statLabel}>supporters</div>
              </div>
            </div>

            <div style={styles.linkRow}>
              <span style={styles.linkText}>vidfund.app/{c.slug}</span>
              <button style={styles.copyBtn} onClick={() => copyLink(c.slug)}>Copy link</button>
            </div>

            <div style={styles.withdrawBox}>
              {unpaid <= 0 ? (
                <span style={styles.withdrawNote}>Nothing to withdraw yet</span>
              ) : c.withdrawal_requested_at ? (
                <span style={styles.withdrawRequested}>
                  ✅ Withdrawal requested {timeAgo(c.withdrawal_requested_at)} — sent to your MoMo within 24h
                </span>
              ) : (
                <button style={styles.withdrawBtn} onClick={() => requestWithdrawal(c.id)}>
                  Request withdrawal (₵{unpaid.toLocaleString()})
                </button>
              )}
            </div>

            <div style={styles.commentsSection}>
              <div style={styles.commentsLabel}>Supporters &amp; comments</div>
              {c.donations.length === 0 ? (
                <p style={styles.noComments}>No supporters yet.</p>
              ) : (
                <>
                  {visibleDonations.map((d) => (
                    <div key={d.id} style={styles.commentRow}>
                      <div style={styles.commentAmount}>₵{Number(d.amount).toFixed(2)}</div>
                      <div style={styles.commentBody}>
                        <div style={styles.commentNote}>
                          {d.donor_name && d.donor_name !== 'Anonymous' ? d.donor_name : 'Anonymous supporter'}
                        </div>
                        <div style={styles.commentTime}>{timeAgo(d.created_at)}</div>
                      </div>
                    </div>
                  ))}
                  {c.donations.length > 3 && (
                    <button
                      style={styles.showMoreBtn}
                      onClick={() => setExpanded((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                    >
                      {isExpanded ? 'Show less' : `Show all ${c.donations.length}`}
                    </button>
                  )}
                </>
              )}
            </div>

            <div style={styles.manageRow}>
              <button style={styles.pauseBtn} onClick={() => togglePause(c.id, c.status)}>
                {c.status === 'paused' ? 'Resume' : 'Pause'}
              </button>
              <button style={styles.deleteBtn} onClick={() => deleteCampaign(c.id, c.title)}>
                Delete
              </button>
            </div>
          </div>
        );
      })}
      </main>
    </>
  );
}

const styles = {
  page: { maxWidth: 480, margin: '0 auto', padding: '16px 16px 60px', fontFamily: 'system-ui, sans-serif' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 10 },
  newBtn: {
    background: '#1a7d3c', color: '#fff', fontSize: 13, fontWeight: 700, padding: '9px 14px',
    borderRadius: 999, textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap', marginTop: 2,
  },
  h1: { fontSize: 24, marginBottom: 4 },
  sub: { color: '#666', marginBottom: 20, fontSize: 14 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: { padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 15, boxSizing: 'border-box' },
  error: { color: '#c0392b', fontSize: 14, margin: 0 },
  calcBox: { background: '#f4f9f4', border: '1px solid #cfe8cf', borderRadius: 10, padding: 14 },
  submitBtn: {
    padding: '14px 20px', borderRadius: 10, border: 'none', background: '#1a7d3c',
    color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', display: 'block',
  },
  card: {
    background: '#fff', border: '1px solid #e5e5e5', borderRadius: 14, padding: 16, marginBottom: 18,
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: 700, color: '#111', flex: 1 },
  pausedBadge: {
    display: 'inline-block', marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: '#8a5a10',
    background: '#fff4e0', borderRadius: 999, padding: '2px 8px', verticalAlign: 'middle',
  },
  viewStats: { display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' },
  viewCount: { fontSize: 11.5, color: '#888', fontWeight: 600, whiteSpace: 'nowrap' },
  statsRow: { display: 'flex', gap: 10, marginBottom: 12 },
  stat: { flex: 1, background: '#f4f9f4', borderRadius: 10, padding: '10px 12px' },
  statValue: { fontSize: 19, fontWeight: 700, color: '#0B3D2E' },
  statLabel: { fontSize: 11.5, color: '#3a6b4a', marginTop: 2 },
  linkRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa', border: '1px solid #eee', borderRadius: 8, padding: '8px 10px', marginBottom: 12 },
  linkText: { fontSize: 12.5, color: '#555', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  copyBtn: { fontSize: 12, fontWeight: 700, color: '#1a7d3c', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, marginLeft: 8 },
  withdrawBox: { marginBottom: 14 },
  withdrawBtn: {
    width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: '#F2A93B',
    color: '#3a2a00', fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
  },
  withdrawNote: { fontSize: 13, color: '#999', fontStyle: 'italic' },
  withdrawRequested: { fontSize: 13, color: '#1a7d3c', fontWeight: 600, display: 'block' },
  commentsSection: { borderTop: '1px solid #eee', paddingTop: 12 },
  commentsLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#999', fontWeight: 700, marginBottom: 10 },
  noComments: { fontSize: 13.5, color: '#999', margin: 0 },
  commentRow: { display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  commentAmount: { fontSize: 13, fontWeight: 700, color: '#0B3D2E', background: '#f4f9f4', borderRadius: 6, padding: '3px 8px', flexShrink: 0 },
  commentBody: { flex: 1, minWidth: 0 },
  commentNote: { fontSize: 13.5, color: '#333' },
  commentTime: { fontSize: 11.5, color: '#aaa', marginTop: 1 },
  showMoreBtn: { fontSize: 12.5, color: '#1a7d3c', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4 },
  manageRow: { display: 'flex', gap: 8, marginTop: 14, borderTop: '1px solid #eee', paddingTop: 12 },
  pauseBtn: {
    flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: '#F2A93B',
    fontSize: 12.5, fontWeight: 700, color: '#3a2a00', cursor: 'pointer',
  },
  deleteBtn: {
    flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: '#c0392b',
    fontSize: 12.5, fontWeight: 700, color: '#fff', cursor: 'pointer',
  },
};
