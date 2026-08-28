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
