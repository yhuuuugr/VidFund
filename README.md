# Small Money

Fixed-small-amount crowdfunding for Ghana. Creators set a suggested per-donation
amount and a target number of supporters; donors give that amount (or a multiple,
or a custom amount) via Paystack mobile money.

## What's built

- `/` — landing page
- `/create` — campaign creation form, with a live "small money adds up" calculator
- `/create/success` — post-creation share flow (WhatsApp, Facebook, X links; TikTok/Instagram copy-link)
- `/[slug]` — the campaign page: video autoplays muted first, sticky donate bar
  with 1×/2×/3×/5×/Custom amount picker, live progress bar
- `/dashboard` — your manual payout view: shows unpaid balance per campaign
  after your platform fee, click "Mark paid" once you've sent the MoMo yourself
- `/api/donate/confirm` — verifies each payment directly with Paystack's API
  before recording it (never trusts the browser alone)
- `/api/webhook` — Paystack webhook as a backup, in case a donor closes their
  browser right after paying

## Setup

1. **Supabase**
   - Create a project at supabase.com
   - Run `supabase/schema.sql` in the SQL editor
   - Create a public storage bucket called `campaign-videos`
   - Copy your project URL, anon key, and service role key into `.env.local`

2. **Paystack**
   - Get your test keys from the Paystack dashboard
   - Set up a webhook pointing to `https://yourdomain.com/api/webhook`
   - Copy your keys into `.env.local`

3. **Environment**
   ```
   cp .env.local.example .env.local
   ```
   Fill in the values.

4. **Run**
   ```
   npm install
   npm run dev
   ```

## Money flow (current setup)

- All payments run through your single Paystack account — no per-creator subaccounts yet
- Every donation lands in Supabase with the campaign it belongs to
- You review `/dashboard`, see each campaign's unpaid balance, and pay the
  creator's MoMo manually — clicking "Mark paid" records it and takes your
  platform fee out of the calculation
- Platform fee % is set in `.env.local` (`PLATFORM_FEE_PERCENT`) and mirrored
  in `app/dashboard/page.js`

## Known gaps / next steps to consider

- Payout is fully manual by design (your call) — the `payouts` table and
  dashboard just track what you've already sent
- No campaign owner login yet — anyone with the campaign slug's data in
  Supabase could theoretically be impersonated in the creation form; add auth
  before this scales past friends-and-family use
- Donor email is auto-generated since Paystack requires one but donors aren't
  asked for one — fine for now, but means you can't email donors directly later
- Video upload has no size/duration limit enforced yet — worth adding before
  launch so people don't upload huge files
