'use client';

import { useEffect, useState, Fragment } from 'react';
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
  const [loadError, setLoadError] = useState('');
  const [payoutsByCampaign, setPayoutsByCampaign] = useState(new Map());
  const [expandedHistory, setExpandedHistory] = useState(new Set());
  const [reports, setReports] = useState([]);
  const [reportActionLoading, setReportActionLoading] = useState(null); // report id currently processing

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => listener.subscription.unsubscribe();
  }, []);

  const isAdmin = session?.user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (isAdmin) {
      loadCampaigns();
      loadReports();
    }
  }, [isAdmin]);

  async function loadReports() {
    // Errors here were previously discarded entirely — a failed query
    // (permissions, a bad join, anything) looked identical to "no reports",
    // with zero indication anything had gone wrong.
    const { data, error } = await supabase
      .from('reports')
      .select('*, campaigns(title, slug)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) console.error('loadReports failed:', error.message);
    setReports(data || []);
  }

  async function handleReportAction(reportId, action) {
    if (action === 'confirm_fraud') {
      const confirmed = confirm(
        'Confirm this fundraiser as fraudulent? This will remove the page, block any payout, and refund 50% of every donation via Paystack. This cannot be undone.'
      );
      if (!confirmed) return;
    }

    setReportActionLoading(reportId);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/process-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({ report_id: reportId, action }),
      });
      const result = await res.json();

      if (!res.ok) {
        alert(`Error: ${result.error}`);
      } else if (action === 'confirm_fraud') {
        alert(
          `Done. Refunded ${result.refunded_count} of ${result.total_donations} donations.` +
          (result.failures.length ? `\n${result.failures.length} refund(s) failed — check Paystack.` : '')
        );
      }

      loadReports();
      loadCampaigns();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setReportActionLoading(null);
    }
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

  async function loadCampaigns() {
    setLoading(true);

    // campaign_totals is a view (a join + aggregation), and PostgREST can't
    // reliably auto-detect a relationship from a view back to a real table
    // for embedding (select('*, campaigns(...)')) — no schema cache reload
    // fixes this, it's a structural limitation, not a caching bug. Fetching
    // both separately and merging here in JS sidesteps it entirely, and
    // keeps the exact same shape (row.campaigns.title etc.) the rest of
    // this file already expects, so nothing else needs to change.
    const [totalsRes, campaignsRes, payoutsRes] = await Promise.all([
      supabase.from('campaign_totals').select('*'),
      supabase.from('campaigns').select('id, creator_name, creator_email, creator_momo_number, title, withdrawal_requested_at, fraud_flagged'),
      supabase.from('payouts').select('*').order('created_at', { ascending: false }),
    ]);

    if (totalsRes.error || campaignsRes.error || payoutsRes.error) {
      const message = totalsRes.error?.message || campaignsRes.error?.message || payoutsRes.error?.message;
      console.error('loadCampaigns failed:', message);
      setLoadError(message);
      setCampaigns([]);
      setLoading(false);
      return;
    }
    setLoadError('');

    // Group every past payout by which campaign it belongs to, so each
    // row can show its own dated payment history without a separate query
    // per campaign.
    const payoutsMap = new Map();
    for (const p of payoutsRes.data || []) {
      if (!payoutsMap.has(p.campaign_id)) payoutsMap.set(p.campaign_id, []);
      payoutsMap.get(p.campaign_id).push(p);
    }
    setPayoutsByCampaign(payoutsMap);

    const campaignsById = new Map((campaignsRes.data || []).map((c) => [c.id, c]));
    const merged = (totalsRes.data || []).map((t) => ({
      ...t,
      campaigns: campaignsById.get(t.campaign_id) || null,
    }));

    // Requested-and-unpaid first, then by balance — so the ones actually
    // waiting on you surface at the top instead of getting lost in the sort.
    const sorted = merged.sort((a, b) => {
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

    // Payouts/donations have no client write access (see supabase/schema.sql) —
    // this has to go through a server route using the service role key.
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/mark-paid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const result = await res.json();
      if (!res.ok) {
        alert(`Error: ${result.error}`);
        return;
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
      return;
    }

    loadCampaigns();
  }

  function toggleHistory(campaignId) {
    setExpandedHistory((prev) => {
      const next = new Set(prev);
      if (next.has(campaignId)) next.delete(campaignId);
      else next.add(campaignId);
      return next;
    });
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

      {reports.length > 0 && (
        <div style={{ marginBottom: 30 }}>
          <h2 style={{ fontSize: 18, color: '#c0392b', marginBottom: 10 }}>
            Pending reports ({reports.length})
          </h2>
          {reports.map((r) => (
            <div key={r.id} style={{ background: '#fdf2f0', border: '1px solid #f5c6c0', borderRadius: 10, padding: 14, marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>
                {r.campaigns?.title} <span style={{ color: '#999', fontWeight: 400, fontSize: 12 }}>· {timeAgo(r.created_at)}</span>
              </div>
              <div style={{ fontSize: 14, color: '#333', marginBottom: 4 }}>{r.reason}</div>
              {r.reporter_contact && (
                <div style={{ fontSize: 12.5, color: '#888', marginBottom: 8 }}>Contact: {r.reporter_contact}</div>
              )}
              <a href={`/${r.campaigns?.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: '#1a7d3c', fontWeight: 700 }}>
                View campaign →
              </a>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  onClick={() => handleReportAction(r.id, 'dismiss')}
                  disabled={reportActionLoading === r.id}
                  style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: 13 }}
                >
                  Dismiss
                </button>
                <button
                  onClick={() => handleReportAction(r.id, 'confirm_fraud')}
                  disabled={reportActionLoading === r.id}
                  style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#c0392b', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                >
                  {reportActionLoading === r.id ? 'Processing…' : 'Confirm fraud & refund 50%'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ color: '#666' }}>Platform fee: {(PLATFORM_FEE_PERCENT * 100).toFixed(0)}% per donation</p>

      {loadError && (
        <div style={{ background: '#fdecea', border: '1px solid #f5b7b1', color: '#c0392b', padding: '12px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13.5 }}>
          <strong>Couldn't load campaigns:</strong> {loadError}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
            <th style={th}>Campaign</th>
            <th style={th}>Creator</th>
            <th style={th}>Account</th>
            <th style={th}>MoMo</th>
            <th style={th}>Status</th>
            <th style={th}>Unpaid balance</th>
            <th style={th}>You send (after fee)</th>
            <th style={th}></th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => {
            const unpaid = Number(c.unpaid_balance || 0);
            const toSend = unpaid * (1 - PLATFORM_FEE_PERCENT);
            const requestedAt = c.campaigns?.withdrawal_requested_at;
            const history = payoutsByCampaign.get(c.campaign_id) || [];
            const isExpanded = expandedHistory.has(c.campaign_id);
            const totalPaidOut = history.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            return (
              <Fragment key={c.campaign_id}>
                <tr style={{ borderBottom: '1px solid #f0f0f0', background: requestedAt ? '#fff9ec' : 'transparent' }}>
                  <td style={td}>{c.campaigns?.title}</td>
                  <td style={td}>{c.campaigns?.creator_name}</td>
                  <td style={{ ...td, color: c.campaigns?.creator_email ? '#333' : '#bbb', fontSize: 12.5 }}>
                    {c.campaigns?.creator_email || 'no account'}
                  </td>
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
                    {c.campaigns?.fraud_flagged ? (
                      <span style={{ fontSize: 12, color: '#c0392b', fontWeight: 700 }}>Fraud — blocked</span>
                    ) : unpaid > 0 && (
                      <button
                        onClick={() => markPaidOut(c.campaign_id, unpaid)}
                        style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#1a7d3c', color: '#fff', cursor: 'pointer' }}
                      >
                        Mark paid
                      </button>
                    )}
                  </td>
                  <td style={td}>
                    {history.length > 0 && (
                      <button
                        onClick={() => toggleHistory(c.campaign_id)}
                        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 12.5, color: '#333' }}
                      >
                        {isExpanded ? '▾' : '▸'} History ({history.length})
                      </button>
                    )}
                  </td>
                </tr>
                {isExpanded && history.length > 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: '0 6px 14px', background: '#fafafa' }}>
                      <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: '#555', background: '#f3f3f3', borderBottom: '1px solid #eee' }}>
                          Payout history — ₵{totalPaidOut.toFixed(2)} paid total
                        </div>
                        {history.map((p) => (
                          <div
                            key={p.id}
                            style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: 13, borderBottom: '1px solid #f2f2f2' }}
                          >
                            <span style={{ color: '#666' }}>
                              {new Date(p.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                              {' · '}
                              {new Date(p.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span style={{ color: '#666' }}>{p.momo_number}</span>
                            <span style={{ fontWeight: 700, color: '#1a7d3c' }}>₵{Number(p.amount).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}

const th = { padding: '8px 6px', fontSize: 13, color: '#666' };
const td = { padding: '10px 6px', fontSize: 14 };
