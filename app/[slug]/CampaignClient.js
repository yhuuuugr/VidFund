'use client';

import { useState, useEffect, useMemo } from 'react';
import Script from 'next/script';
import { supabase } from '../../lib/supabaseClient';
import VideoPlayer from './VideoPlayer';

export default function CampaignClient({ campaign, totals: initialTotals }) {
  const [totals, setTotals] = useState(initialTotals);
  const [selectedAmount, setSelectedAmount] = useState(null); // null until first pick
  const [customAmount, setCustomAmount] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [donorNote, setDonorNote] = useState('');
  const [showNoteField, setShowNoteField] = useState(false);
  const [paystackReady, setPaystackReady] = useState(false);

  const suggested = Number(campaign.suggested_amount);
  // Plain preset amounts — not "1x/2x/3x" multipliers, which read as
  // quantities/products rather than donation amounts.
  const presetAmounts = [1, 2, 3, 5].map((m) => suggested * m);
  const firstName = (campaign.creator_name || 'them').trim().split(' ')[0];

  const amount = useMemo(() => {
    if (showCustom) return Number(customAmount) || 0;
    return selectedAmount ?? presetAmounts[0];
  }, [showCustom, customAmount, selectedAmount, presetAmounts]);

  const unitsSoFar = totals?.total_units || 0;
  const targetUnits = campaign.target_units;
  const progressPct = Math.min(100, (unitsSoFar / targetUnits) * 100);
  const goalTotal = suggested * targetUnits;
  const isPaused = campaign.status === 'paused';

  // Count this page load as a view — powers the creator dashboard.
  useEffect(() => {
    supabase.rpc('increment_campaign_view', { campaign_slug: campaign.slug });
  }, [campaign.slug]);

  // Refresh totals every 15s so the progress bar feels live without a full backend push setup
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('campaign_totals')
        .select('*')
        .eq('slug', campaign.slug)
        .single();
      if (data) setTotals(data);
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
        }).then(() => {
          window.location.reload();
        });
      },
      onClose: function () {},
    });
    handler.openIframe();
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
          <VideoPlayer src={campaign.video_url} />
        ) : (
          <div style={styles.videoFallback}>{campaign.title}</div>
        )}

        <p style={styles.videoCaption}>
          {firstName} recorded this video to tell you what happened.
        </p>

        {isPaused && (
          <div style={styles.pausedBanner}>
            This fundraiser is currently paused by its creator. New donations aren't being accepted right now.
          </div>
        )}

        <div style={styles.content}>
          <h1 style={styles.title}>{campaign.title}</h1>

          <div style={styles.storyLabel}>{firstName}'s story</div>
          <blockquote style={styles.storyQuote}>"{campaign.story}"</blockquote>

          {/* Progress — the number matters more than decoration here */}
          <div style={styles.progressBlock}>
            <div style={styles.raisedRow}>
              <span style={styles.raisedAmount}>₵{(totals?.total_raised || 0).toLocaleString()}</span>
              <span style={styles.raisedGoal}>raised of ₵{goalTotal.toLocaleString()}</span>
            </div>
            <div style={styles.progressBarBg}>
              <div style={{ ...styles.progressBarFill, width: `${progressPct}%` }} />
            </div>
            <div style={styles.helpedLine}>
              {Math.floor(unitsSoFar).toLocaleString()} people have helped {firstName}
            </div>
          </div>
        </div>

        {/* Sticky donate bar - stays visible while video plays */}
        {!isPaused && (
        <div style={styles.stickyBar}>
          <div style={styles.stickyInner}>
            <div style={styles.askLine}>Would you like to help?</div>

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

            <button style={styles.donateBtn} onClick={startPayment}>
              Support {firstName} with ₵{amount.toFixed(0)}
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
};
