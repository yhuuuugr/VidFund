'use client';

import { useState, useEffect, useMemo } from 'react';
import Script from 'next/script';
import { supabase } from '../../lib/supabaseClient';
import VideoPlayer from './VideoPlayer';

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function CampaignClient({ campaign, totals: initialTotals }) {
  const [totals, setTotals] = useState(initialTotals);
  const [selectedAmount, setSelectedAmount] = useState(null); // null until first pick
  const [customAmount, setCustomAmount] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [donorNote, setDonorNote] = useState('');
  const [showNoteField, setShowNoteField] = useState(false);
  const [paystackReady, setPaystackReady] = useState(false);
  const [recentDonations, setRecentDonations] = useState([]);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportContact, setReportContact] = useState('');
  const [reportStatus, setReportStatus] = useState('idle'); // idle | submitting | done | error
  const [moreVideos, setMoreVideos] = useState([]);
  const [videoEnded, setVideoEnded] = useState(false);
  const [showMoreList, setShowMoreList] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [confirmingDonation, setConfirmingDonation] = useState(false);
  const [donationError, setDonationError] = useState('');

  const suggested = Number(campaign.suggested_amount);
  // Plain preset amounts — not "1x/2x/3x" multipliers, which read as
  // quantities/products rather than donation amounts.
  const presetAmounts = [1, 2, 3, 5].map((m) => suggested * m);
  const firstName = (campaign.creator_name || 'them').trim().split(' ')[0];
  const isCreatorSupport = campaign.category === 'creator';
  const unlockKey = `vidfund_unlocked_${campaign.creator_email}`;

  // If this creator has other videos, fetch them so "watch more" can appear
  // once the current one finishes. Contributing unlocks browsing the rest.
  useEffect(() => {
    if (!isCreatorSupport || !campaign.creator_email) return;
    supabase
      .from('campaigns')
      .select('slug, title')
      .eq('creator_email', campaign.creator_email)
      .eq('category', 'creator')
      .eq('status', 'active')
      .neq('id', campaign.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setMoreVideos(data || []));

    if (typeof window !== 'undefined') {
      setIsUnlocked(localStorage.getItem(unlockKey) === 'true');
    }
  }, [isCreatorSupport, campaign.creator_email, campaign.id, unlockKey]);

  const amount = useMemo(() => {
    if (showCustom) return Number(customAmount) || 0;
    return selectedAmount ?? presetAmounts[0];
  }, [showCustom, customAmount, selectedAmount, presetAmounts]);

  const unitsSoFar = totals?.total_units || 0;
  const targetUnits = campaign.target_units; // null for Creator Support — no fixed goal
  const hasTarget = targetUnits != null && targetUnits > 0;
  const progressPct = hasTarget ? Math.min(100, (unitsSoFar / targetUnits) * 100) : 0;
  const goalTotal = hasTarget ? suggested * targetUnits : 0;
  const isPaused = campaign.status === 'paused';

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/${campaign.slug}` : '';
  const shareText = `Help ${firstName} — ${campaign.title}`;
  const shareLinks = {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
  };

  function copyShareLink() {
    navigator.clipboard.writeText(shareUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: campaign.title, text: shareText, url: shareUrl });
      } catch (e) {
        // user cancelled the share sheet — not an error
      }
    } else {
      copyShareLink();
    }
  }

  async function submitReport(e) {
    e.preventDefault();
    if (reportReason.trim().length < 10) {
      setReportStatus('too-short');
      return;
    }
    setReportStatus('submitting');
    const { error } = await supabase.from('reports').insert({
      campaign_id: campaign.id,
      reason: reportReason.trim(),
      reporter_contact: reportContact || null,
    });
    if (error) {
      setReportStatus('error');
    } else {
      setReportStatus('done');
    }
  }

  // Count this page load as a view — powers the creator dashboard.
  useEffect(() => {
    supabase.rpc('increment_campaign_view', { campaign_slug: campaign.slug }).then(({ error }) => {
      if (error) console.error('increment_campaign_view failed:', error.message);
    });
  }, [campaign.slug]);

  async function loadRecentDonations() {
    const { data } = await supabase
      .from('donations')
      .select('amount, donor_name, created_at')
      .eq('campaign_id', campaign.id)
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) setRecentDonations(data);
  }

  useEffect(() => {
    loadRecentDonations();
  }, [campaign.id]);

  // Refresh totals every 15s so the progress bar feels live without a full backend push setup
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('campaign_totals')
        .select('*')
        .eq('slug', campaign.slug)
        .single();
      if (data) setTotals(data);
      loadRecentDonations();
    }, 15000);
    return () => clearInterval(interval);
  }, [campaign.slug]);

  function startPayment() {
    if (!paystackReady || !window.PaystackPop) {
      alert('Payment is still loading — try again in a second.');
      return;
    }
    if (amount < 1) {
      alert('Enter a valid amount.');
      return;
    }

    const handler = window.PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      email: `donor-${Date.now()}@small-money-donor.com`, // Paystack requires an email; donors aren't asked for one
      amount: Math.round(amount * 100), // pesewas
      currency: 'GHS',
      channels: ['mobile_money', 'card'],
      metadata: {
        campaign_id: campaign.id,
        donor_name: donorNote || 'Anonymous',
      },
      callback: function (response) {
        setConfirmingDonation(true);
        setDonationError('');
        fetch('/api/donate/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: response.reference,
            campaign_id: campaign.id,
            amount,
            units: amount / suggested,
            donor_name: donorNote || null,
          }),
        })
          .then(async (res) => {
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              throw new Error(body.error || 'We could not confirm your donation.');
            }
            if (isCreatorSupport && campaign.creator_email && typeof window !== 'undefined') {
              localStorage.setItem(unlockKey, 'true');
            }
            window.location.reload();
          })
          .catch((err) => {
            setConfirmingDonation(false);
            setDonationError(
              `Your payment went through, but we couldn't confirm it on our end (ref: ${response.reference}). ` +
              `Please contact support with this reference — don't pay again. (${err.message})`
            );
          });
      },
      onClose: function () {},
    });
    handler.openIframe();
  }

  // Confirmed fraudulent — fully block the page rather than just hiding the donate button
  if (campaign.status === 'removed') {
    return (
      <main style={styles.removedPage}>
        <h1 style={styles.removedTitle}>This page has been removed</h1>
        <p style={styles.removedText}>
          It was reported and, after review, confirmed to violate VidFund's Terms of Service.
          Contributors have been refunded 50% of their donations.
        </p>
      </main>
    );
  }

  return (
    <>
      <Script
        src="https://js.paystack.co/v1/inline.js"
        onLoad={() => setPaystackReady(true)}
      />

      <main style={styles.page}>
        {/* The video is the whole point — it dominates the page */}
        {campaign.video_url ? (
          <VideoPlayer
            src={campaign.video_url}
            portraitHeight={isCreatorSupport ? '62vh' : '48vh'}
            loop={moreVideos.length === 0}
            onEnded={() => setVideoEnded(true)}
          />
        ) : (
          <div style={styles.videoFallback}>{campaign.title}</div>
        )}

        {!isCreatorSupport && (
          <p style={styles.videoCaption}>
            {firstName} recorded this video to tell you what happened.
          </p>
        )}

        {isPaused && (
          <div style={styles.pausedBanner}>
            This page is currently paused by its creator. New donations aren't being accepted right now.
          </div>
        )}

        {isCreatorSupport ? (
          <div style={styles.content}>
            <h1 style={styles.title}>{campaign.title}</h1>

            {/* Never frame a fresh page as empty — invite the first supporter instead */}
            <div style={styles.helpedLine}>
              {unitsSoFar > 0
                ? `${Math.floor(unitsSoFar).toLocaleString()} fans are supporting ${firstName}`
                : `Be the first to support ${firstName}`}
            </div>

            <button onClick={handleNativeShare} style={styles.smallShareBtn}>
              {linkCopied ? 'Link copied!' : 'Share'}
            </button>

            {campaign.story && (
              <>
                <div style={styles.storyLabel}>Why I'm asking</div>
                <blockquote style={styles.storyQuote}>"{campaign.story}"</blockquote>
              </>
            )}

            {videoEnded && moreVideos.length > 0 && (
              <div style={styles.watchMoreBox}>
                {isUnlocked ? (
                  !showMoreList ? (
                    <button style={styles.watchMoreBtn} onClick={() => setShowMoreList(true)}>
                      Watch more videos from {firstName} →
                    </button>
                  ) : (
                    <>
                      <div style={styles.storyLabel}>More from {firstName}</div>
                      {moreVideos.map((v) => (
                        <a key={v.slug} href={`/${v.slug}`} style={styles.moreVideoLink}>
                          🎥 {v.title}
                        </a>
                      ))}
                    </>
                  )
                ) : (
                  <button style={styles.watchMoreBtnLocked} onClick={startPayment}>
                    Watch more videos from {firstName}
                  </button>
                )}
              </div>
            )}

            <div style={styles.trustLine}>
              Created by {campaign.creator_name} via VidFund
            </div>

            {recentDonations.length > 0 && (
              <div style={styles.recentSection}>
                <div style={styles.storyLabel}>Recent support</div>
                {recentDonations.map((d, i) => (
                  <div key={i} style={styles.recentRow}>
                    <span style={styles.recentHeart}>❤️</span>
                    <span style={styles.recentName}>
                      {d.donor_name && d.donor_name !== 'Anonymous' ? d.donor_name : 'Anonymous'}
                    </span>
                    <span style={styles.recentAmount}>₵{Number(d.amount).toFixed(0)}</span>
                    <span style={styles.recentTime}>{timeAgo(d.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
        <div style={styles.content}>
          <h1 style={styles.title}>{campaign.title}</h1>

          {campaign.story && (
            <>
              <div style={styles.storyLabel}>{firstName}'s story</div>
              <blockquote style={styles.storyQuote}>"{campaign.story}"</blockquote>
            </>
          )}

          {/* Progress — the number matters more than decoration here */}
          <div style={styles.progressBlock}>
            <div style={styles.raisedRow}>
              <span style={styles.raisedAmount}>₵{(totals?.total_raised || 0).toLocaleString()}</span>
              {hasTarget && <span style={styles.raisedGoal}>raised of ₵{goalTotal.toLocaleString()}</span>}
            </div>
            {hasTarget && (
              <div style={styles.progressBarBg}>
                <div style={{ ...styles.progressBarFill, width: `${progressPct}%` }} />
              </div>
            )}
            <div style={styles.helpedLine}>
              {Math.floor(unitsSoFar).toLocaleString()} people have helped {firstName}
            </div>
          </div>

          {/* Sharing is what actually spreads the fundraiser — make it hard to miss */}
          <div style={styles.shareSection}>
            <div style={styles.shareTitle}>Help {firstName} reach the goal</div>
            <a href={shareLinks.whatsapp} target="_blank" rel="noreferrer" style={styles.whatsappBtn}>
              Share on WhatsApp
            </a>
            <div style={styles.shareRow}>
              <a href={shareLinks.facebook} target="_blank" rel="noreferrer" style={styles.shareSmallBtn}>Facebook</a>
              <a href={shareLinks.x} target="_blank" rel="noreferrer" style={styles.shareSmallBtn}>X</a>
              <button onClick={copyShareLink} style={styles.shareSmallBtn}>
                {linkCopied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          </div>

          {/* Honest trust signals only — no fabricated verification badges */}
          <div style={styles.trustLine}>
            Page created by {campaign.creator_name} via VidFund · Payments processed securely by Paystack
          </div>

          {recentDonations.length > 0 && (
            <div style={styles.recentSection}>
              <div style={styles.storyLabel}>Recent support</div>
              {recentDonations.map((d, i) => (
                <div key={i} style={styles.recentRow}>
                  <span style={styles.recentHeart}>❤️</span>
                  <span style={styles.recentName}>
                    {d.donor_name && d.donor_name !== 'Anonymous' ? d.donor_name : 'Anonymous'}
                  </span>
                  <span style={styles.recentAmount}>₵{Number(d.amount).toFixed(0)}</span>
                  <span style={styles.recentTime}>{timeAgo(d.created_at)}</span>
                </div>
              ))}
            </div>
          )}

          <div style={styles.reportWrap}>
            {!showReportForm ? (
              <button style={styles.reportLink} onClick={() => setShowReportForm(true)}>
                Report this page
              </button>
            ) : reportStatus === 'done' ? (
              <p style={styles.reportDone}>Thanks — we'll review this.</p>
            ) : (
              <form onSubmit={submitReport} style={styles.reportForm}>
                <label style={styles.reportLabel}>
                  Why are you reporting this page?
                  <textarea
                    style={styles.reportTextarea}
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Explain what seems wrong or suspicious"
                    required
                  />
                </label>
                <input
                  style={styles.reportInput}
                  type="text"
                  value={reportContact}
                  onChange={(e) => setReportContact(e.target.value)}
                  placeholder="Your email or phone (optional, for follow-up)"
                />
                {reportStatus === 'error' && (
                  <p style={styles.reportError}>Something went wrong. Try again.</p>
                )}
                {reportStatus === 'too-short' && (
                  <p style={styles.reportError}>Please give a bit more detail so we can review this properly.</p>
                )}
                <button type="submit" style={styles.reportSubmitBtn} disabled={reportStatus === 'submitting'}>
                  {reportStatus === 'submitting' ? 'Submitting…' : 'Submit report'}
                </button>
              </form>
            )}
          </div>
        </div>
        )}

        {/* Sticky donate bar - stays visible while video plays */}
        {!isPaused && (
        <div style={styles.stickyBar}>
          <div style={styles.stickyInner}>
            <div style={styles.askLine}>
              {isCreatorSupport ? `Tip ${firstName} for this video?` : 'Would you like to help?'}
            </div>

            <div style={styles.amountRow}>
              {presetAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => {
                    setSelectedAmount(amt);
                    setShowCustom(false);
                  }}
                  style={{
                    ...styles.amountBtn,
                    ...(!showCustom && amount === amt ? styles.amountBtnActive : {}),
                  }}
                >
                  ₵{amt.toFixed(0)}
                </button>
              ))}
              <button
                onClick={() => setShowCustom(true)}
                style={{
                  ...styles.amountBtn,
                  ...(showCustom ? styles.amountBtnActive : {}),
                }}
              >
                Custom
              </button>
            </div>

            {showCustom && (
              <input
                type="number"
                placeholder="Enter amount in ₵"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                style={styles.customInput}
                min="1"
              />
            )}

            {!showNoteField ? (
              <button style={styles.noteToggle} onClick={() => setShowNoteField(true)}>
                + Add a note (optional)
              </button>
            ) : (
              <input
                type="text"
                placeholder="Say something nice (optional)"
                value={donorNote}
                onChange={(e) => setDonorNote(e.target.value)}
                style={styles.customInput}
              />
            )}

            {donationError && <p style={styles.donationError}>{donationError}</p>}

            <button style={styles.donateBtn} onClick={startPayment} disabled={confirmingDonation}>
              {confirmingDonation
                ? 'Confirming your payment…'
                : isCreatorSupport
                ? `Tip ${firstName} ₵${amount.toFixed(0)}`
                : `Support ${firstName} with ₵${amount.toFixed(0)}`}
            </button>
          </div>
        </div>
        )}
      </main>
    </>
  );
}

const styles = {
  page: { maxWidth: 480, margin: '0 auto', fontFamily: 'system-ui, sans-serif', paddingBottom: 210, background: '#FFFBF2' },
  videoFallback: {
    width: '100%', aspectRatio: '16/9', background: '#0B3D2E',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 18, fontWeight: 700, textAlign: 'center', padding: 20, boxSizing: 'border-box',
  },
  videoCaption: {
    fontSize: 13, color: '#8a8a8a', fontStyle: 'italic', textAlign: 'center',
    margin: '10px 16px 0',
  },
  pausedBanner: {
    background: '#fff4e0', color: '#8a5a10', fontSize: 13.5, fontWeight: 600,
    padding: '12px 16px', textAlign: 'center', margin: '14px 16px 0', borderRadius: 10,
  },
  content: { padding: '20px 20px 8px' },
  title: { fontSize: 26, fontWeight: 800, lineHeight: 1.25, margin: '0 0 18px', color: '#1A1A1A' },
  storyLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#999', fontWeight: 700, marginBottom: 8 },
  storyQuote: {
    margin: '0 0 26px', padding: '2px 0 2px 16px', borderLeft: '3px solid #F2A93B',
    fontSize: 18, fontStyle: 'italic', color: '#333', lineHeight: 1.5, fontWeight: 500,
  },
  progressBlock: { margin: '0 0 12px' },
  raisedRow: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  raisedAmount: { fontSize: 34, fontWeight: 800, color: '#0B3D2E', lineHeight: 1 },
  raisedGoal: { fontSize: 15, color: '#777', fontWeight: 500 },
  progressBarBg: { background: '#eee', borderRadius: 999, height: 14, overflow: 'hidden' },
  progressBarFill: { background: 'linear-gradient(90deg, #1a7d3c, #0B3D2E)', height: '100%', transition: 'width 0.6s ease' },
  helpedLine: { fontSize: 14.5, color: '#444', marginTop: 10, fontWeight: 600 },
  shareSection: {
    marginTop: 28, background: '#f4f9f4', border: '1px solid #cfe8cf',
    borderRadius: 14, padding: 16,
  },
  shareTitle: { fontSize: 15.5, fontWeight: 700, color: '#0B3D2E', marginBottom: 12 },
  whatsappBtn: {
    display: 'block', textAlign: 'center', width: '100%', boxSizing: 'border-box',
    background: '#25D366', color: '#fff', fontSize: 15.5, fontWeight: 700,
    padding: '13px', borderRadius: 10, textDecoration: 'none', marginBottom: 10,
  },
  nativeShareBtn: {
    display: 'block', textAlign: 'center', width: '100%', boxSizing: 'border-box',
    background: '#1a7d3c', color: '#fff', fontSize: 15.5, fontWeight: 700,
    padding: '13px', borderRadius: 10, border: 'none', cursor: 'pointer',
  },
  smallShareBtn: {
    display: 'inline-block', background: '#f4f9f4', color: '#1a7d3c', border: '1px solid #cfe8cf',
    fontSize: 13, fontWeight: 700, padding: '7px 16px', borderRadius: 999, cursor: 'pointer',
    marginTop: 10, marginBottom: 4,
  },
  watchMoreBox: {
    marginTop: 22, background: '#f4f9f4', border: '1px solid #cfe8cf', borderRadius: 14, padding: 16,
  },
  watchMoreBtn: {
    display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'center',
    background: '#0B3D2E', color: '#fff', fontSize: 14.5, fontWeight: 700,
    padding: '13px', borderRadius: 10, border: 'none', textDecoration: 'none', cursor: 'pointer',
  },
  watchMoreBtnLocked: {
    display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'center',
    background: '#fff', color: '#0B3D2E', fontSize: 14.5, fontWeight: 700,
    padding: '13px', borderRadius: 10, border: '1.5px dashed #cfe8cf', cursor: 'pointer',
  },
  lockedNote: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 10, marginBottom: 0, lineHeight: 1.5 },
  moreVideoLink: {
    display: 'block', fontSize: 14, color: '#0B3D2E', fontWeight: 600, textDecoration: 'none',
    padding: '10px 0', borderBottom: '1px solid #e5e5e5',
  },
  shareRow: { display: 'flex', gap: 8 },
  shareSmallBtn: {
    flex: 1, textAlign: 'center', padding: '10px', borderRadius: 8,
    border: '1px solid #cfe8cf', background: '#fff', color: '#2a6b2a',
    fontSize: 13, fontWeight: 700, textDecoration: 'none', cursor: 'pointer',
  },
  trustLine: {
    marginTop: 18, fontSize: 12, color: '#999', lineHeight: 1.5, textAlign: 'center',
  },
  recentSection: { marginTop: 26, paddingBottom: 4 },
  recentRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f2f2f2' },
  recentHeart: { fontSize: 13, flexShrink: 0 },
  recentName: { fontSize: 13.5, color: '#333', fontWeight: 600, flex: 1 },
  recentAmount: { fontSize: 13.5, color: '#0B3D2E', fontWeight: 700 },
  recentTime: { fontSize: 11.5, color: '#aaa', marginLeft: 6, whiteSpace: 'nowrap' },
  reportWrap: { marginTop: 24, paddingTop: 14, borderTop: '1px solid #f0f0f0' },
  reportLink: { background: 'none', border: 'none', color: '#aaa', fontSize: 12.5, textDecoration: 'underline', cursor: 'pointer', padding: 0 },
  reportDone: { fontSize: 13, color: '#2a6b2a' },
  reportForm: { display: 'flex', flexDirection: 'column', gap: 10 },
  reportLabel: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#555' },
  reportTextarea: { padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14, minHeight: 70, fontFamily: 'inherit', boxSizing: 'border-box' },
  reportInput: { padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14, boxSizing: 'border-box' },
  reportError: { fontSize: 13, color: '#c0392b', margin: 0 },
  reportSubmitBtn: { padding: '10px', borderRadius: 8, border: 'none', background: '#555', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' },
  removedPage: {
    maxWidth: 480, margin: '0 auto', padding: '60px 24px', fontFamily: 'system-ui, sans-serif',
    textAlign: 'center', minHeight: '100vh', boxSizing: 'border-box',
  },
  removedTitle: { fontSize: 22, color: '#1A1A1A', marginBottom: 12 },
  removedText: { fontSize: 15, color: '#666', lineHeight: 1.6 },
  stickyBar: {
    position: 'fixed', bottom: 0, left: 0, right: 0, background: '#FFFBF2',
    borderTop: '1px solid #e5ddc8', boxShadow: '0 -6px 16px rgba(0,0,0,0.06)',
  },
  stickyInner: { maxWidth: 480, margin: '0 auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 9, boxSizing: 'border-box' },
  askLine: { fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 1 },
  amountRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  amountBtn: {
    flex: '1 1 auto', padding: '10px 8px', borderRadius: 8, border: '1.5px solid #ddd',
    background: '#fff', fontSize: 14, fontWeight: 700, color: '#333', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  amountBtnActive: { background: '#0B3D2E', color: '#fff', borderColor: '#0B3D2E' },
  customInput: { padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14, boxSizing: 'border-box' },
  noteToggle: { background: 'none', border: 'none', color: '#1a7d3c', fontSize: 13, textAlign: 'left', cursor: 'pointer', padding: 0 },
  donateBtn: {
    padding: '15px', borderRadius: 10, border: 'none', background: '#1a7d3c',
    color: '#fff', fontSize: 16.5, fontWeight: 700, cursor: 'pointer', marginTop: 2,
  },
  donationError: {
    color: '#c0392b', fontSize: 13, fontWeight: 600, margin: 0, lineHeight: 1.4,
  },
};
