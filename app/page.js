import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 40, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 28 }}>Small money adds up.</h1>
      <p style={{ color: '#666', marginTop: 8, marginBottom: 32 }}>
        Start a fundraiser where everyone gives a little — and together, it's a lot.
      </p>
      <Link
        href="/create"
        style={{
          display: 'inline-block',
          padding: '14px 28px',
          borderRadius: 10,
          background: '#1a7d3c',
          color: '#fff',
          textDecoration: 'none',
          fontWeight: 700,
        }}
      >
        Start a fundraiser
      </Link>
    </main>
  );
}
