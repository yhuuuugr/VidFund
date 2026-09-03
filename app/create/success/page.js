'use client';

import { useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { BrandIcon, buildShareTargets } from '../../../components/shareIcons';

function ShareSuccessInner() {
  const params = useSearchParams();
  const slug = params.get('slug');
  const [copied, setCopied] = useState(false);

  // process.env.NEXT_PUBLIC_SITE_URL is inlined at build time, so it's
  // correct on the server-rendered HTML and the client immediately — no
  // need to wait for a useEffect to patch it in after hydration, which
  // previously left a short window where the share links pointed nowhere.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const link = `${siteUrl}/${slug}`;
  const shareText = `I just started a fundraiser — please help support it:`;
  const shareTargets = buildShareTargets(link, shareText);

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
        {shareTargets.map((target) =>
          target.kind === 'link' ? (
            <a key={target.key} href={target.href} target="_blank" rel="noreferrer" style={styles.shareBtn}>
              <BrandIcon name={target.key} size={20} />
              {target.label}
            </a>
          ) : (
            <button key={target.key} style={styles.shareBtn} onClick={copyLink} title={target.hint}>
              <BrandIcon name={target.key} size={20} />
              {target.label} ({copied ? 'copied!' : 'copy link'})
            </button>
          )
        )}
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
    display: 'flex', alignItems: 'center', gap: 10,
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
