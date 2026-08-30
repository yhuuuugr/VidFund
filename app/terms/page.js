import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — VidFund',
};

export default function Terms() {
  return (
    <main style={styles.page}>
      <Link href="/" style={styles.back}>← Back to VidFund</Link>
      <h1 style={styles.h1}>Terms of Service</h1>
      <p style={styles.updated}>Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

      <p style={styles.p}>
        These Terms of Service ("Terms") govern your use of VidFund (the "Platform," "we,"
        "us"), a video-based fundraising service. By creating a fundraiser, donating, or
        otherwise using VidFund, you agree to these Terms. If you don't agree, please don't
        use the Platform.
      </p>

      <h2 style={styles.h2}>1. What VidFund is — and isn't</h2>
      <p style={styles.p}>
        VidFund is a technology platform that lets people record a video, publish a
        fundraising page, and collect small donations from supporters via mobile money and
        card payments. <strong>VidFund is not a bank, charity, escrow service, or guarantor.</strong>{' '}
        We do not verify the identity of campaign creators, the accuracy of their stories, or
        how donated funds are ultimately used. Donations are voluntary gifts made directly to
        the person running the campaign, not to VidFund.
      </p>

      <h2 style={styles.h2}>2. Who can use VidFund</h2>
      <p style={styles.p}>
        You must be at least 18 years old to create a fundraiser or receive payouts. By
        creating a campaign, you confirm that you are legally able to enter into these Terms
        and to receive funds in your own name via mobile money.
      </p>

      <h2 style={styles.h2}>3. Creating a fundraiser</h2>
      <p style={styles.p}>When you create a campaign, you agree that:</p>
      <ul style={styles.ul}>
        <li>The story, title, and details you provide are truthful and not misleading.</li>
        <li>The MoMo name and number you provide are accurate and belong to you, or to someone you are explicitly authorized to collect funds on behalf of.</li>
        <li>You will use donated funds for the purpose described in your campaign, to the extent reasonably possible.</li>
        <li>You are solely responsible for any tax, legal, or regulatory obligations arising from funds you receive.</li>
      </ul>
      <p style={styles.p}>
        VidFund may pause, hide, or permanently remove any campaign — at any time, with or
        without notice — that we reasonably believe is fraudulent, misleading, illegal, or
        in violation of these Terms.
      </p>

      <h2 style={styles.h2}>4. Donating</h2>
      <p style={styles.p}>
        Donations made through VidFund are voluntary gifts to the campaign creator. Because
        of this, <strong>donations are generally non-refundable</strong>, whether or not the
        campaign's goal is reached or the funds are used as described. If you believe a
        campaign is fraudulent, please contact us — we can pause or remove the campaign, but
        we cannot guarantee recovery of funds already sent, since money moves directly toward
        payout to the creator.
      </p>

      <h2 style={styles.h2}>4a. Reporting a fundraiser</h2>
      <p style={styles.p}>
        Any visitor can report a fundraiser they believe is fake, fraudulent, or misleading,
        directly from the campaign page. VidFund reviews reports manually. If a campaign is
        confirmed to be fraudulent following review:
      </p>
      <ul style={styles.ul}>
        <li>The campaign page is permanently removed and can no longer accept donations.</li>
        <li>The creator forfeits any right to funds already raised — no payout will be made.</li>
        <li>Each contributor to that campaign will be refunded 50% of the amount they donated, processed back to their original payment method.</li>
      </ul>
      <p style={styles.p}>
        The remaining 50% is not refunded because payment processing fees are non-recoverable
        once a transaction has settled, and reviewing and reversing fraudulent campaigns
        carries a cost. This policy is designed to meaningfully compensate donors while
        remaining operationally sustainable. Decisions on reported campaigns are made at
        VidFund's discretion following manual review, and are final.
      </p>

      <h2 style={styles.h2}>5. Fees</h2>
      <p style={styles.p}>
        VidFund deducts a platform fee (currently 5%) from each donation before payout to the
        creator. Payment processors (such as Paystack) may also deduct their own processing
        fee. These fees are disclosed in-app and may change; the current rate always applies
        to future donations.
      </p>

      <h2 style={styles.h2}>6. Payouts</h2>
      <p style={styles.p}>
        Funds raised are currently disbursed manually by VidFund to the creator's provided
        mobile money account, typically after the creator requests a withdrawal. VidFund does
        not guarantee a specific payout timeline. You are responsible for ensuring your MoMo
        details are correct — VidFund is not liable for funds sent to an incorrect account
        due to inaccurate information you provided.
      </p>

      <h2 style={styles.h2}>7. Prohibited use</h2>
      <p style={styles.p}>You may not use VidFund to:</p>
      <ul style={styles.ul}>
        <li>Raise funds for illegal purposes, or misrepresent the purpose of a campaign.</li>
        <li>Impersonate another person or organization.</li>
        <li>Post content that is hateful, harassing, sexually exploitative, or otherwise harmful.</li>
        <li>Attempt to defraud donors or other users.</li>
        <li>Interfere with or disrupt the Platform's normal operation.</li>
      </ul>

      <h2 style={styles.h2}>8. Content you upload</h2>
      <p style={styles.p}>
        You retain ownership of the videos and content you upload. By publishing a campaign,
        you grant VidFund a license to host, display, and distribute that content as part of
        operating the Platform (for example, showing your video on your campaign page and in
        link previews when shared).
      </p>

      <h2 style={styles.h2}>9. No guarantee of outcomes</h2>
      <p style={styles.p}>
        VidFund does not guarantee that any campaign will reach its goal, that donations will
        be made, or that funds will be used appropriately by the creator. We are not
        responsible for disputes between creators and donors.
      </p>

      <h2 style={styles.h2}>10. Limitation of liability</h2>
      <p style={styles.p}>
        To the fullest extent permitted by law, VidFund and its operators are not liable for
        any indirect, incidental, or consequential damages arising from your use of the
        Platform, including but not limited to loss of funds, fraud by a third party, or
        campaign content.
      </p>

      <h2 style={styles.h2}>11. Changes to these Terms</h2>
      <p style={styles.p}>
        We may update these Terms from time to time. Continued use of VidFund after changes
        take effect means you accept the updated Terms.
      </p>

      <h2 style={styles.h2}>12. Governing law</h2>
      <p style={styles.p}>
        These Terms are governed by the laws of Ghana. Any disputes will be subject to the
        exclusive jurisdiction of the courts of Ghana.
      </p>

      <h2 style={styles.h2}>13. Contact</h2>
      <p style={styles.p}>
        Questions about these Terms can be sent to the contact details provided on the
        Platform.
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
