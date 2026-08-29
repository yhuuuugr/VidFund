'use client';

import { useState, useEffect, useMemo } from 'react';
import Script from 'next/script';
import { supabase } from '../../lib/supabaseClient';
import VideoPlayer from './VideoPlayer';

export default function CampaignClient({ campaign, totals: initialTotals }) {
  const [totals, setTotals] = useState(initialTotals);
  const [multiplier, setMultiplier] = useState(1);
  const [customAmount, setCustomAmount] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [donorName, setDonorName] = useState('');
  const [showNameField, setShowNameField] = useState(false);
  const [paystackReady, setPaystackReady] = useState(false);

  const suggested = Number(campaign.suggested_amount);
  const multiplierOptions = [1, 2, 3, 5];

  const amount = useMemo(() => {
    if (showCustom) return Number(customAmount) || 0;
    return suggested * multiplier;
  }, [showCustom, customAmount, multiplier, suggested]);

  const unitsSoFar = totals?.total_units || 0;
  const targetUnits = campaign.target_units;
  const progressPct = Math.min(100, (unitsSoFar / targetUnits) * 100);

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
        donor_name: donorName || 'Anonymous',
      },
      callback: function (response) {
        // Confirm server-side via webhook/verify endpoint — never trust the client callback alone
        fetch('/api/donate/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: response.reference,
            campaign_id: campaign.id,
            amount,
            units: amount / suggested,
            donor_name: donorName || null,
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
        <div style={styles.content}>
          {/* Video is contained and compact — no more eating most of the screen */}
          {campaign.video_url ? (
            <VideoPlayer src={campaign.video_url} />
          ) : (
            <div style={styles.videoFallback}>{campaign.title}</div>
          )}

          <h1 style={styles.title}>{campaign.title}</h1>
          <p style={styles.creator}>by {campaign.creator_name}</p>

          <div style={styles.progressBarBg}>
            <div style={{ ...styles.progressBarFill, width: `${progressPct}%` }} />
          </div>
          <p style={styles.progressText}>
            ₵{(totals?.total_raised || 0).toLocaleString()} raised ·{' '}
            {Math.floor(unitsSoFar).toLocaleString()}/{targetUnits.toLocaleString()} supporters
          </p>

          <p style={styles.story}>{campaign.story}</p>
        </div>

        {/* Sticky donate bar - stays visible while video plays */}
        <div style={styles.stickyBar}>
          <div style={styles.stickyInner}>
            <div style={styles.amountRow}>
              {multiplierOptions.map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMultiplier(m);
                    setShowCustom(false);
                  }}
                  style={{
                    ...styles.multBtn,
                    ...(multiplier === m && !showCustom ? styles.multBtnActive : {}),
                  }}
                >
                  {m}× ₵{(suggested * m).toFixed(0)}
                </button>
              ))}
              <button
                onClick={() => setShowCustom(true)}
                style={{
                  ...styles.multBtn,
                  ...(showCustom ? styles.multBtnActive : {}),
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

            {!showNameField ? (
              <button style={styles.nameToggle} onClick={() => setShowNameField(true)}>
                + Add your name (optional)
              </button>
            ) : (
              <input
                type="text"
                placeholder="Your name"
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                style={styles.customInput}
              />
            )}

            <button style={styles.donateBtn} onClick={startPayment}>
              Support with ₵{amount.toFixed(2)}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

const styles = {
  page: { maxWidth: 480, margin: '0 auto', fontFamily: 'system-ui, sans-serif', paddingBottom: 180 },
  content: { padding: '16px' },
  videoFallback: {
    width: '100%', aspectRatio: '16/9', borderRadius: 14, background: '#0B3D2E',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 18, fontWeight: 700, textAlign: 'center', padding: 20, boxSizing: 'border-box',
  },
  title: { fontSize: 22, marginTop: 16, marginBottom: 4 },
  creator: { color: '#666', fontSize: 14, marginBottom: 16 },
  progressBarBg: { background: '#eee', borderRadius: 999, height: 10, overflow: 'hidden' },
  progressBarFill: { background: '#1a7d3c', height: '100%', transition: 'width 0.3s' },
  progressText: { fontSize: 14, color: '#333', marginTop: 8, fontWeight: 600 },
  story: { marginTop: 20, lineHeight: 1.6, color: '#222', whiteSpace: 'pre-wrap' },
  stickyBar: {
    position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff',
    borderTop: '1px solid #e0e0e0', boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
  },
  stickyInner: { maxWidth: 480, margin: '0 auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 },
  amountRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  multBtn: {
    flex: '1 1 auto', padding: '8px 10px', borderRadius: 8, border: '1px solid #ccc',
    background: '#fafafa', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  multBtnActive: { background: '#1a7d3c', color: '#fff', borderColor: '#1a7d3c' },
  customInput: { padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 },
  nameToggle: { background: 'none', border: 'none', color: '#1a7d3c', fontSize: 13, textAlign: 'left', cursor: 'pointer', padding: 0 },
  donateBtn: {
    padding: '14px', borderRadius: 10, border: 'none', background: '#1a7d3c',
    color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
  },
};
