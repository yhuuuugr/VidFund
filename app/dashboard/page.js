'use client';

import { useEffect, useState, Fragment } from 'react';
import { supabase } from '../../lib/supabaseClient';

const PLATFORM_FEE_PERCENT = 0.05; // keep in sync with .env PLATFORM_FEE_PERCENT
const ADMIN_EMAIL = 'edwinafriyie16@gmail.com';

const c = {
  cream: '#FFFBF2',
  border: '#E3DFD2',
  borderSubtle: '#EFEBDF',
  text: '#1A1A1A',
  textSecondary: '#5B5A53',
  textMuted: '#A8A59A',
  lineBlue: '#2E6BE6',
};

const heading = { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 };
const mono = { fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 };
const body = { fontFamily: "'Inter', sans-serif" };

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function money(n) {
  return `₵${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      `Mark ${money(payoutAmount)} as paid to this creator (after ${money(platformCut)} platform fee)?`
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
    return (
      <main style={{ padding: 24, ...body, color: c.text }}>
        <p style={{ fontSize: 14, color: c.textSecondary }}>Loading…</p>
      </main>
    );
  }

  if (session === null) {
    return (
      <main style={{ maxWidth: 400, margin: '64px auto 0', padding: '0 24px', ...body }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: c.text, marginBottom: 20 }} />
        <h1 style={{ ...heading, fontSize: 22, color: c.text, margin: '0 0 6px' }}>Admin sign in</h1>
        <p style={{ color: c.textSecondary, fontSize: 14, marginBottom: 24 }}>This page is restricted to the VidFund admin account.</p>
        {!otpSent ? (
          <form onSubmit={handleSendMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{ padding: '11px 13px', borderRadius: 8, border: `1px solid ${c.border}`, fontSize: 14.5, ...body, background: '#fff', color: c.text, outline: 'none' }}
            />
            {authError && <p style={{ color: c.text, fontSize: 13.5, margin: 0 }}>{authError}</p>}
            <button
              type="submit"
              disabled={authSubmitting}
              style={{ padding: '12px', borderRadius: 8, border: 'none', background: c.text, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', ...body }}
            >
              {authSubmitting ? 'Sending…' : 'Send me a sign-in link'}
            </button>
          </form>
        ) : (
          <p style={{ fontSize: 14, color: c.textSecondary }}>Check <strong style={{ color: c.text }}>{authEmail}</strong> for a sign-in link.</p>
        )}
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main style={{ maxWidth: 400, margin: '64px auto 0', padding: '0 24px', textAlign: 'center', ...body }}>
        <h1 style={{ ...heading, fontSize: 22, color: c.text, margin: '0 0 8px' }}>Access denied</h1>
        <p style={{ color: c.textSecondary, fontSize: 14 }}>
          Signed in as {session.user.email}. This page is restricted to the admin account.
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{ marginTop: 14, background: 'none', border: 'none', color: c.text, fontWeight: 600, fontSize: 14, textDecoration: 'underline', cursor: 'pointer', ...body }}
        >
          Sign out
        </button>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={{ padding: 24, ...body }}>
        <p style={{ fontSize: 14, color: c.textSecondary }}>Loading…</p>
      </main>
    );
  }

  const totalUnpaid = campaigns.reduce((sum, cRow) => sum + Number(cRow.unpaid_balance || 0), 0);
  const requestedCount = campaigns.filter((cRow) => cRow.campaigns?.withdrawal_requested_at).length;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap"
        rel="stylesheet"
      />
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px 80px', ...body, color: c.text }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: `1px solid ${c.border}`, paddingBottom: 20 }}>
          <div>
            <h1 style={{ ...heading, fontSize: 24, margin: 0 }}>Payout dashboard</h1>
            <p style={{ fontSize: 13, color: c.textMuted, margin: '5px 0 0' }}>Platform fee {(PLATFORM_FEE_PERCENT * 100).toFixed(0)}% per donation</p>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ background: 'none', border: 'none', color: c.textSecondary, fontSize: 13, cursor: 'pointer', ...body }}
          >
            Sign out
          </button>
        </div>

        {/* Stat strip */}
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '22px 0' }}>
          <thead>
            <tr>
              <Th>Pending reports</Th>
              <Th>Total unpaid balance</Th>
              <Th last>Withdrawals requested</Th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: `3px solid ${c.lineBlue}` }}>
              <StatCell value={reports.length} ok={reports.length === 0} />
              <StatCell value={money(totalUnpaid)} ok={totalUnpaid === 0} />
              <StatCell value={requestedCount} ok={requestedCount === 0} last />
            </tr>
          </tbody>
        </table>

        {loadError && (
          <div style={{ border: `1px solid ${c.text}`, color: c.text, padding: '12px 14px', borderRadius: 8, marginBottom: 20, fontSize: 13.5 }}>
            <strong>Couldn&apos;t load campaigns:</strong> {loadError}
          </div>
        )}

        {/* Reports */}
        <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 18 }}>
          {reports.length > 0 ? (
            <>
              <h2 style={{ ...heading, fontSize: 15, color: c.text, margin: '0 0 12px' }}>
                Pending reports ({reports.length})
              </h2>
              {reports.map((r) => (
                <div
                  key={r.id}
                  style={{
                    borderLeft: `2px solid ${c.text}`,
                    borderRadius: 0,
                    padding: '10px 0 12px 16px',
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontWeight: 600, fontSize: 14.5 }}>{r.campaigns?.title}</span>
                    <span style={{ color: c.textMuted, fontSize: 12, whiteSpace: 'nowrap' }}>{timeAgo(r.created_at)}</span>
                  </div>
                  <p style={{ fontSize: 13.5, color: c.textSecondary, margin: '5px 0 4px' }}>{r.reason}</p>
                  {r.reporter_contact && (
                    <p style={{ fontSize: 12, color: c.textMuted, margin: '0 0 10px' }}>Contact: {r.reporter_contact}</p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    <button
                      onClick={() => handleReportAction(r.id, 'dismiss')}
                      disabled={reportActionLoading === r.id}
                      style={{ padding: '7px 14px', borderRadius: 6, border: `1px solid ${c.border}`, background: '#fff', cursor: 'pointer', fontSize: 12.5, ...body }}
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleReportAction(r.id, 'confirm_fraud')}
                      disabled={reportActionLoading === r.id}
                      style={{ padding: '7px 14px', borderRadius: 6, border: `1px solid ${c.text}`, background: c.text, color: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, ...body }}
                    >
                      {reportActionLoading === r.id ? 'Processing…' : 'Confirm fraud, refund 50%'}
                    </button>
                    <a
                      href={`/${r.campaigns?.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ marginLeft: 'auto', fontSize: 12.5, color: c.text, fontWeight: 600, textDecoration: 'underline' }}
                    >
                      View campaign
                    </a>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <p style={{ fontSize: 13, color: c.textSecondary, margin: 0 }}>
              No pending reports. Anything flagged by a visitor shows up here first.
            </p>
          )}
        </div>

        {/* Campaigns */}
        <div style={{ borderTop: `1px solid ${c.border}`, marginTop: 22, paddingTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{
              ...heading, fontSize: 15, color: c.text, background: '#F2A93B',
              padding: '9px 18px', borderRadius: 8, display: 'inline-block',
            }}>
              Campaigns
            </span>
            <span style={{ fontSize: 12, color: c.textMuted }}>{campaigns.length} total</span>
          </div>

          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: `3px solid ${c.lineBlue}` }}>
                  <Th>Campaign</Th>
                  <Th>Creator</Th>
                  <Th>Account</Th>
                  <Th>MoMo</Th>
                  <Th>Status</Th>
                  <Th align="right">Unpaid</Th>
                  <Th align="right">You send</Th>
                  <Th></Th>
                  <Th last></Th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((cRow) => {
                  const unpaid = Number(cRow.unpaid_balance || 0);
                  const toSend = unpaid * (1 - PLATFORM_FEE_PERCENT);
                  const requestedAt = cRow.campaigns?.withdrawal_requested_at;
                  const isFraud = cRow.campaigns?.fraud_flagged;
                  const history = payoutsByCampaign.get(cRow.campaign_id) || [];
                  const isExpanded = expandedHistory.has(cRow.campaign_id);
                  const totalPaidOut = history.reduce((sum, p) => sum + Number(p.amount || 0), 0);
                  const needsAttention = isFraud || requestedAt;

                  return (
                    <Fragment key={cRow.campaign_id}>
                      <tr style={{ borderBottom: `3px solid ${c.lineBlue}` }}>
                        <Td style={{ borderLeft: needsAttention ? `2px solid ${c.text}` : '2px solid transparent', fontWeight: 600 }}>{cRow.campaigns?.title}</Td>
                        <Td style={{ fontWeight: 700, color: c.text }}>{cRow.campaigns?.creator_name}</Td>
                        <Td style={{ fontWeight: 700, color: c.lineBlue, fontSize: 12.5 }}>
                          {cRow.campaigns?.creator_email || 'no account'}
                        </Td>
                        <Td style={{ fontWeight: 700, color: c.text }}>{cRow.campaigns?.creator_momo_number}</Td>
                        <Td>
                          {isFraud ? (
                            <span style={{ fontSize: 12, fontWeight: 600, color: c.text, textDecoration: 'underline' }}>Fraud — blocked</span>
                          ) : requestedAt ? (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: c.text }}>Requested {timeAgo(requestedAt)}</div>
                              <div style={{ fontSize: 11.5, fontWeight: 700, color: c.lineBlue, marginTop: 2 }}>
                                {cRow.campaigns?.creator_email || cRow.campaigns?.creator_momo_number}
                              </div>
                            </div>
                          ) : unpaid > 0 ? (
                            <span style={{ fontSize: 12, fontWeight: 700, color: c.text }}>Not requested</span>
                          ) : (
                            <span style={{ fontSize: 12, fontWeight: 700, color: c.text }}>—</span>
                          )}
                        </Td>
                        <Td align="right" style={{ ...mono, fontSize: 13, fontWeight: 700, color: c.text }}>{money(unpaid)}</Td>
                        <Td align="right" style={{ ...mono, fontSize: 13, fontWeight: 700, color: c.text }}>{unpaid > 0 ? money(toSend) : '—'}</Td>
                        <Td>
                          {isFraud ? (
                            <span style={{ fontSize: 11.5, color: c.textMuted, fontStyle: 'italic' }}>Payout disabled</span>
                          ) : unpaid > 0 && (
                            <button
                              onClick={() => markPaidOut(cRow.campaign_id, unpaid)}
                              style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${c.text}`, background: c.text, color: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, ...body }}
                            >
                              Mark paid
                            </button>
                          )}
                        </Td>
                        <Td last>
                          {history.length > 0 && (
                            <button
                              onClick={() => toggleHistory(cRow.campaign_id)}
                              style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${c.border}`, background: '#fff', cursor: 'pointer', fontSize: 12, color: c.textSecondary, whiteSpace: 'nowrap', ...body }}
                            >
                              {isExpanded ? '▾' : '▸'} History ({history.length})
                            </button>
                          )}
                        </Td>
                      </tr>
                      {isExpanded && history.length > 0 && (
                        <tr>
                          <td colSpan={9} style={{ padding: '0 0 14px', background: '#EAF1FE' }}>
                            <div style={{ padding: '10px 20px' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: c.text, marginBottom: 6 }}>
                                {money(totalPaidOut)} paid total
                              </div>
                              {history.map((p) => (
                                <div
                                  key={p.id}
                                  style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13, borderBottom: `1px solid ${c.border}` }}
                                >
                                  <span style={{ fontWeight: 700, color: c.text }}>
                                    {new Date(p.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                    {' · '}
                                    {new Date(p.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <span style={{ fontWeight: 700, color: c.text }}>{p.momo_number}</span>
                                  <span style={{ ...mono, fontWeight: 700, color: c.text }}>{money(p.amount)}</span>
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
          </div>
        </div>
      </main>
    </>
  );
}

function StatCell({ value, ok, last }) {
  return (
    <td style={{
      padding: '16px 14px', textAlign: 'left',
      borderRight: last ? 'none' : `3px solid ${c.lineBlue}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          background: ok ? '#1A7D3C' : '#D64545',
        }} />
        <span style={{ ...mono, fontSize: 22, fontWeight: 700, color: c.text }}>{value}</span>
      </div>
    </td>
  );
}

function Th({ children, align, last }) {
  if (!children) {
    return (
      <th style={{ padding: '9px 14px', background: '#F2A93B', borderRight: last ? 'none' : `3px solid ${c.lineBlue}` }} />
    );
  }
  return (
    <th style={{
      padding: '9px 14px', textAlign: align || 'left',
      background: '#F2A93B',
      borderRight: last ? 'none' : `3px solid ${c.lineBlue}`,
    }}>
      <span style={{ ...heading, fontSize: 11.5, color: c.text, whiteSpace: 'nowrap' }}>
        {children}
      </span>
    </th>
  );
}

function Td({ children, align, style, last }) {
  return (
    <td style={{
      padding: '11px 14px 11px 0', fontSize: 13.5, textAlign: align || 'left',
      borderRight: last ? 'none' : `3px solid ${c.lineBlue}`,
      ...body, ...style,
    }}>
      {children}
    </td>
  );
}
