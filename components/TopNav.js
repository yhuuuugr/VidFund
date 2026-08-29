'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

export default function TopNav() {
  const [session, setSession] = useState(undefined);

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
      <Link href="/my-fundraisers" style={styles.accountBtn} aria-label="Your account">
        {initial || '👤'}
      </Link>
    </div>
  );
}

const styles = {
  bar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    maxWidth: 480, margin: '0 auto', padding: '14px 16px 0', boxSizing: 'border-box',
  },
  wordmark: {
    fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16,
    color: '#1A1A1A', textDecoration: 'none',
  },
  accountBtn: {
    width: 32, height: 32, borderRadius: '50%', background: '#0B3D2E', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
    fontWeight: 700, textDecoration: 'none', flexShrink: 0,
  },
};
