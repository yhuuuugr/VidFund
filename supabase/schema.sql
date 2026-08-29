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
