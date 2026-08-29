'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

export default function TopNav() {
  const [session, setSession] = useState(undefined);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => listener.subscription.unsubscribe();
  }, []);

  const initial = session?.user?.email ? session.user.email[0].toUpperCase() : null;

  return (
    <div style={styles.bar}>
      <Link href="/" style={styles.wordmark}>
        VidFund<span style={{ color: '#F2A93B' }}>.</span>
      </Link>

      <div style={styles.accountWrap}>
        <button style={styles.accountBtn} onClick={() => setMenuOpen((o) => !o)} aria-label="Account menu">
          {initial || '👤'}
        </button>

        {menuOpen && (
          <>
            <div style={styles.backdrop} onClick={() => setMenuOpen(false)} />
            <div style={styles.menu}>
              {session?.user?.email && <div style={styles.menuEmail}>{session.user.email}</div>}
              <Link href="/my-fundraisers" style={styles.menuItem} onClick={() => setMenuOpen(false)}>
                📋 My fundraisers
              </Link>
              <Link href="/create" style={styles.menuItem} onClick={() => setMenuOpen(false)}>
                🎥 Start a fundraiser
              </Link>
              {session && (
                <button
                  style={styles.menuItemBtn}
                  onClick={() => {
                    supabase.auth.signOut();
                    setMenuOpen(false);
                  }}
                >
                  🚪 Sign out
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  bar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    maxWidth: 480, margin: '0 auto', padding: '14px 16px 0', boxSizing: 'border-box',
    position: 'relative', zIndex: 20,
  },
  wordmark: {
    fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16,
    color: '#1A1A1A', textDecoration: 'none',
  },
  accountWrap: { position: 'relative' },
  accountBtn: {
    width: 32, height: 32, borderRadius: '50%', background: '#0B3D2E', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
    fontWeight: 700, border: 'none', cursor: 'pointer', flexShrink: 0,
  },
  backdrop: { position: 'fixed', inset: 0, zIndex: 20, background: 'transparent' },
  menu: {
    position: 'absolute', top: 40, right: 0, zIndex: 21,
    background: '#fff', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
    border: '1px solid #eee', minWidth: 190, overflow: 'hidden', padding: '6px 0',
  },
  menuEmail: {
    fontSize: 11.5, color: '#999', padding: '8px 14px 6px', borderBottom: '1px solid #f0f0f0',
    marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  menuItem: {
    display: 'block', padding: '10px 14px', fontSize: 14, color: '#222',
    textDecoration: 'none', fontWeight: 500,
  },
  menuItemBtn: {
    display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 14,
    color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500,
    fontFamily: 'inherit',
  },
};
