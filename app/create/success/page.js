'use client';

import { useSearchParams } from 'next/navigation';
import { useState, Suspense, useEffect } from 'react';

function ShareSuccessInner() {
  const params = useSearchParams();
  const slug = params.get('slug');
  const [copied, setCopied] = useState(false);
  const [siteUrl, setSiteUrl] = useState(process.env.NEXT_PUBLIC_SITE_URL || '');

  // If the env var isn't set correctly, fall back to whatever domain the
  // page is actually being viewed on — so the link is never just a bare
  // path with no domain (which breaks sharing entirely).
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SITE_URL && typeof window !== 'undefined') {
      setSiteUrl(window.location.origin);
    }
  }, []);

  const link = `${siteUrl}/${slug}`;
  const shareText = `I just started a fundraiser — please help support it:`;

  const shareLinks = {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + link)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(link)}`,
    // TikTok and Instagram don't support prefilled web share links —
    // point people to copy the link and paste it into their bio/caption/story instead.
  };

  function copyLink() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main style={styles.page}>
      <h1 style={styles.h1}>🎉 Your fundraiser is live!</h1>
      <p style={styles.link}>{link}</p>

      <button style={styles.copyBtn} onClick={copyLink}>
        {copied ? 'Copied!' : 'Copy link'}
      </button>

      <p style={styles.shareLabel}>Share to:</p>
      <div style={styles.shareGrid}>
        <a href={shareLinks.whatsapp} target="_blank" rel="noreferrer" style={styles.shareBtn}>
          🟢 WhatsApp
        </a>
        <a href={shareLinks.facebook} target="_blank" rel="noreferrer" style={styles.shareBtn}>
          🔵 Facebook
        </a>
        <a href={shareLinks.x} target="_blank" rel="noreferrer" style={styles.shareBtn}>
          𝕏 X
        </a>
        <button style={styles.shareBtn} onClick={copyLink}>
          🎵 TikTok (copy link, paste in bio)
        </button>
        <button style={styles.shareBtn} onClick={copyLink}>
          📸 Instagram (copy link, paste in story)
        </button>
      </div>

      <a href="/my-fundraisers" style={styles.dashboardLink}>
        View your dashboard →
      </a>
    </main>
  );
}

export default function ShareSuccess() {
  return (
    <Suspense fallback={null}>
      <ShareSuccessInner />
    </Suspense>
  );
}

const styles = {
  page: { maxWidth: 480, margin: '0 auto', padding: '32px 16px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' },
  h1: { fontSize: 22 },
  link: { color: '#1a7d3c', fontWeight: 600, wordBreak: 'break-all', margin: '12px 0' },
  copyBtn: { padding: '10px 18px', borderRadius: 8, border: '1px solid #ccc', background: '#fff', cursor: 'pointer', marginBottom: 24 },
  shareLabel: { fontWeight: 700, marginBottom: 12 },
  shareGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  dashboardLink: { display: 'block', marginTop: 20, fontSize: 14, color: '#1a7d3c', fontWeight: 700, textDecoration: 'none' },
  shareBtn: {
    padding: '14px',
    borderRadius: 10,
    border: '1px solid #ddd',
    background: '#fafafa',
    textDecoration: 'none',
    color: '#111',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 15,
  },
};
