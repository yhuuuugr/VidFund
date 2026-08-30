import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — VidFund',
};

export default function Privacy() {
  return (
    <main style={styles.page}>
      <Link href="/" style={styles.back}>← Back to VidFund</Link>
      <h1 style={styles.h1}>Privacy Policy</h1>
      <p style={styles.updated}>Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

      <p style={styles.p}>
        This Privacy Policy explains what information VidFund collects, why, and how it's
        used. It applies to anyone who creates a fundraiser, donates, or otherwise uses
        VidFund.
      </p>

      <h2 style={styles.h2}>1. Information we collect</h2>
      <p style={styles.p}><strong>When you create a fundraiser:</strong></p>
      <ul style={styles.ul}>
        <li>Your email address (used to sign in — we use passwordless sign-in links, so we never see or store a password).</li>
        <li>Your name and mobile money number, provided for receiving payouts.</li>
        <li>The video, title, story, and category you publish.</li>
        <li>Basic activity on your campaign — how many times the page was opened.</li>
      </ul>
      <p style={styles.p}><strong>When you donate:</strong></p>
      <ul style={styles.ul}>
        <li>The amount you give and an optional note you choose to leave.</li>
        <li>Payment details are handled directly by Paystack, our payment processor — VidFund does not see or store your card or mobile money PIN.</li>
      </ul>

      <h2 style={styles.h2}>2. How we use this information</h2>
      <p style={styles.p}>We use the information above to:</p>
      <ul style={styles.ul}>
        <li>Operate your fundraiser page and process donations.</li>
        <li>Send payouts to the mobile money account you provide.</li>
        <li>Show your campaign's progress to visitors (raised amount, supporter count).</li>
        <li>Detect and prevent fraud or misuse of the Platform.</li>
        <li>Communicate with you about your account or campaign, if needed.</li>
      </ul>
      <p style={styles.p}>We do not sell your personal information to advertisers or other third parties.</p>

      <h2 style={styles.h2}>3. Who we share information with</h2>
      <p style={styles.p}>VidFund relies on a small number of service providers to operate:</p>
      <ul style={styles.ul}>
        <li><strong>Supabase</strong> — stores your account, campaign, and donation data.</li>
        <li><strong>Paystack</strong> — processes payments and mobile money transfers.</li>
        <li><strong>Vercel</strong> — hosts the VidFund website.</li>
      </ul>
      <p style={styles.p}>
        Your campaign title, story, video, category, and progress are public by design —
        anyone with your link can view them. Your email and MoMo details are never shown
        publicly.
      </p>

      <h2 style={styles.h2}>4. Data retention</h2>
      <p style={styles.p}>
        We keep campaign and donation records for as long as your account exists, and as
        needed to resolve disputes, keep financial records, or comply with the law. If you
        delete a campaign, its public page is removed immediately; underlying donation
        records may be retained for accounting purposes.
      </p>

      <h2 style={styles.h2}>5. Your rights</h2>
      <p style={styles.p}>
        Under Ghana's Data Protection Act, 2012 (Act 843), you have the right to know what
        personal data we hold about you, request corrections, and request deletion of your
        account, subject to any legal or financial record-keeping requirements. You can
        delete your own campaigns at any time from your dashboard. For other requests,
        contact us using the details on the Platform.
      </p>

      <h2 style={styles.h2}>6. Children's privacy</h2>
      <p style={styles.p}>
        VidFund is not intended for anyone under 18. We do not knowingly collect personal
        information from children.
      </p>

      <h2 style={styles.h2}>7. Security</h2>
      <p style={styles.p}>
        We take reasonable steps to protect your information, including relying on
        established providers (Supabase, Paystack, Vercel) with their own security
        practices. No system is completely secure, and we can't guarantee absolute security
        of information you provide.
      </p>

      <h2 style={styles.h2}>8. Changes to this policy</h2>
      <p style={styles.p}>
        We may update this Privacy Policy from time to time. Continued use of VidFund after
        changes take effect means you accept the updated policy.
      </p>

      <h2 style={styles.h2}>9. Contact</h2>
      <p style={styles.p}>
        Questions about this policy or your data can be sent to the contact details provided
        on the Platform.
      </p>
    </main>
  );
}

const styles = {
  page: { maxWidth: 620, margin: '0 auto', padding: '24px 20px 60px', fontFamily: 'system-ui, sans-serif', color: '#222', lineHeight: 1.6 },
  back: { fontSize: 13, color: '#1a7d3c', textDecoration: 'none', fontWeight: 600 },
  h1: { fontSize: 26, marginTop: 16, marginBottom: 4 },
  updated: { fontSize: 13, color: '#888', marginBottom: 24 },
  h2: { fontSize: 17, marginTop: 28, marginBottom: 8, color: '#0B3D2E' },
  p: { fontSize: 15, marginBottom: 12 },
  ul: { fontSize: 15, marginBottom: 12, paddingLeft: 20 },
};
