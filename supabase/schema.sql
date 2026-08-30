-- Run this in the Supabase SQL editor

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  story text not null,
  category text not null default 'other',
  video_url text,
  cover_image_url text,
  suggested_amount numeric not null,       -- in GHS, e.g. 2.00
  target_units integer not null,           -- e.g. 4000 units of suggested_amount
  creator_name text not null,
  creator_momo_number text not null,
  creator_email text,
  status text not null default 'active',   -- active | paused | ended
  created_at timestamptz not null default now()
);

create table donations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  amount numeric not null,                 -- actual GHS amount charged
  units numeric not null,                  -- amount / suggested_amount, counts toward target
  donor_name text,                         -- optional, donor can stay anonymous
  paystack_reference text unique not null,
  status text not null default 'pending',  -- pending | success | failed
  payout_status text not null default 'unpaid', -- unpaid | paid
  created_at timestamptz not null default now()
);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  amount numeric not null,                 -- amount sent to creator (after platform fee)
  momo_number text not null,
  note text,
  paid_by text,                            -- you, since payout is manual
  created_at timestamptz not null default now()
);

-- helpful view: live totals per campaign
create view campaign_totals as
select
  c.id as campaign_id,
  c.slug,
  c.suggested_amount,
  c.target_units,
  coalesce(sum(d.amount) filter (where d.status = 'success'), 0) as total_raised,
  coalesce(sum(d.units) filter (where d.status = 'success'), 0) as total_units,
  coalesce(sum(d.amount) filter (where d.status = 'success' and d.payout_status = 'unpaid'), 0) as unpaid_balance
from campaigns c
left join donations d on d.campaign_id = c.id
group by c.id;

create index on donations (campaign_id);
create index on donations (paystack_reference);

-- Row-level security policies
-- There's no login system yet, so campaign creation and reading happens
-- from the browser using the public anon key. These policies allow that,
-- while donations/payouts stay locked to the service role key (used only
-- in server-side API routes), so donor payment records can't be tampered
-- with directly from the browser.

alter table campaigns enable row level security;
alter table donations enable row level security;
alter table payouts enable row level security;

-- Anyone can create a campaign (creator self-serve, no login yet)
create policy "Public can create campaigns" on campaigns
  for insert with check (true);

-- Anyone can view campaigns (public fundraiser pages)
create policy "Public can view campaigns" on campaigns
  for select using (true);

-- Donations/payouts are only readable publicly for the live progress bar;
-- writes only happen server-side via the service role key, which bypasses
-- RLS entirely, so no insert/update policy is needed for those.
create policy "Public can view donations" on donations
  for select using (true);

create policy "Public can view payouts" on payouts
  for select using (true);

-- Storage: allow public upload + read for campaign videos
insert into storage.buckets (id, name, public)
values ('campaign-videos', 'campaign-videos', true)
on conflict (id) do nothing;

create policy "Public can upload campaign videos" on storage.objects
  for insert with check (bucket_id = 'campaign-videos');

create policy "Public can read campaign videos" on storage.objects
  for select using (bucket_id = 'campaign-videos');

-- Explicit grants: RLS policies alone aren't enough if the anon/authenticated
-- roles were never given base table privileges. Without this, inserts fail
-- with "permission denied for table X" before RLS is even evaluated.
grant usage on schema public to anon, authenticated;
grant select, insert on campaigns to anon, authenticated;
grant select on donations to anon, authenticated;
grant select on payouts to anon, authenticated;

-- Views don't inherit table grants automatically in Postgres — without this,
-- reading campaign_totals as the anon role fails even though campaigns and
-- donations both have public select policies.
grant select on campaign_totals to anon, authenticated;

-- Creator dashboard support: view counts, withdrawal requests

alter table campaigns add column if not exists view_count integer not null default 0;
alter table campaigns add column if not exists withdrawal_requested_at timestamptz;

-- Safely increments view_count regardless of RLS (security definer), so
-- anonymous visitors can bump the counter without needing write access to
-- the whole campaigns row.
create or replace function increment_campaign_view(campaign_slug text)
returns void as $$
  update campaigns set view_count = view_count + 1 where slug = campaign_slug;
$$ language sql security definer;

grant execute on function increment_campaign_view(text) to anon, authenticated;

-- Only the signed-in creator who owns a campaign (matched by their auth
-- email) can update it — e.g. to request a withdrawal.
drop policy if exists "Creators can update their own campaigns" on campaigns;
create policy "Creators can update their own campaigns" on campaigns
  for update using (creator_email = auth.email())
  with check (creator_email = auth.email());

grant update on campaigns to authenticated;

-- Video play tracking — separate from view_count, since page loads can be
-- triggered by link-preview bots (WhatsApp, etc.) fetching the OG image,
-- which inflates "opens" without a real person watching.
alter table campaigns add column if not exists play_count integer not null default 0;

create or replace function increment_campaign_play(campaign_slug text)
returns void as $$
  update campaigns set play_count = play_count + 1 where slug = campaign_slug;
$$ language sql security definer;

grant execute on function increment_campaign_play(text) to anon, authenticated;

-- Let creators delete their own campaigns (pausing already works via the
-- existing update policy, since "status" is just another column on a row
-- they own).
drop policy if exists "Creators can delete their own campaigns" on campaigns;
create policy "Creators can delete their own campaigns" on campaigns
  for delete using (creator_email = auth.email());

grant delete on campaigns to authenticated;

-- One MoMo profile per signed-in creator, so they only enter their payout
-- details once — future campaigns pre-fill from here instead of asking again.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  momo_name text,
  momo_number text,
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "Users manage their own profile" on profiles;
create policy "Users manage their own profile" on profiles
  for all using (auth.uid() = id)
  with check (auth.uid() = id);

grant select, insert, update on profiles to authenticated;

-- Reporting & fraud handling

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  reason text not null,
  reporter_contact text,
  status text not null default 'pending', -- pending | dismissed | confirmed_fraud
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table reports enable row level security;

-- Anyone can file a report, no login required
drop policy if exists "Public can create reports" on reports;
create policy "Public can create reports" on reports
  for insert with check (true);

-- Only the admin account can read/review reports
drop policy if exists "Admin can view reports" on reports;
create policy "Admin can view reports" on reports
  for select using (auth.email() = 'edwinafriyie16@gmail.com');

drop policy if exists "Admin can update reports" on reports;
create policy "Admin can update reports" on reports
  for update using (auth.email() = 'edwinafriyie16@gmail.com');

grant select, insert, update on reports to anon, authenticated;

-- Track refunds per donation, and whether a campaign was removed for fraud
alter table donations add column if not exists refund_status text not null default 'none'; -- none | refunded
alter table donations add column if not exists refunded_amount numeric not null default 0;

alter table campaigns add column if not exists fraud_flagged boolean not null default false;
alter table campaigns add column if not exists fraud_flagged_at timestamptz;
