-- =====================================================================
-- SwapSpot · 01 · Schema
-- Tables, constraints, indexes and the two read models the app uses.
--
-- Conventions
--   * snake_case names, bigint identity primary keys
--   * text + CHECK for small fixed lists (status, type, method)
--   * timestamptz for every point in time, numeric for money (THB)
--   * every foreign key column has an index
-- =====================================================================

-- Internal objects (security definer functions, triggers) live here.
-- This schema is NOT exposed through the Data API.
create schema if not exists private;

-- ---------------------------------------------------------------------
-- operators: companies that run parking lots (1 operator : N lots)
-- ---------------------------------------------------------------------
create table public.operators (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  created_at timestamptz not null default now()
);
comment on table public.operators is 'Companies that run parking lots. One operator has many lots.';

-- ---------------------------------------------------------------------
-- parking_lots: one row per car park shown on the map
-- ---------------------------------------------------------------------
create table public.parking_lots (
  id                      bigint generated always as identity primary key,
  code                    text not null unique check (code ~ '^[a-z0-9]{2,8}$'),
  operator_id             bigint not null references public.operators (id),
  name                    text not null,
  address                 text not null,
  latitude                numeric(9,6) not null check (latitude between -90 and 90),
  longitude               numeric(9,6) not null check (longitude between -180 and 180),
  total_spots             integer not null check (total_spots > 0),
  available_spots         integer not null check (available_spots >= 0),
  hourly_rate             numeric(8,2) not null check (hourly_rate >= 0),
  daily_max               numeric(8,2) check (daily_max > 0),
  open_time               time not null default '00:00',
  close_time              time not null default '24:00',
  ev_chargers             integer not null default 0 check (ev_chargers >= 0),
  accessible_spots        integer not null default 0 check (accessible_spots >= 0),
  is_covered              boolean not null default false,
  has_security            boolean not null default false,
  free_with_purchase      boolean not null default false,
  rating                  numeric(2,1) check (rating between 0 and 5),
  is_active               boolean not null default true,
  availability_updated_at timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  constraint parking_lots_available_lte_total check (available_spots <= total_spots),
  constraint parking_lots_hours_valid check (close_time > open_time)
);
create index parking_lots_operator_id_idx on public.parking_lots (operator_id);

comment on table public.parking_lots is 'Car parks. available_spots is the latest reading from the (simulated) gate sensor feed.';
comment on column public.parking_lots.code is 'Short code used by the app and the voice assistant, e.g. sp = Siam Paragon.';
comment on column public.parking_lots.hourly_rate is 'Price per hour in THB. 0 = free.';
comment on column public.parking_lots.daily_max is 'Maximum charge for one booking in THB. NULL = no cap.';
comment on column public.parking_lots.open_time is 'Local time (Asia/Bangkok). 00:00 to 24:00 means open 24 hours.';

-- ---------------------------------------------------------------------
-- parking_spots: the bays a driver can book in the app (N per lot)
-- ---------------------------------------------------------------------
create table public.parking_spots (
  id         bigint generated always as identity primary key,
  lot_id     bigint not null references public.parking_lots (id) on delete cascade,
  label      text not null,
  spot_type  text not null default 'standard' check (spot_type in ('standard', 'ev', 'accessible')),
  status     text not null default 'available' check (status in ('available', 'occupied', 'reserved')),
  updated_at timestamptz not null default now(),
  constraint parking_spots_lot_label_key unique (lot_id, label)
);
comment on table public.parking_spots is 'Bookable bays inside a lot. status: available / occupied (a car is there) / reserved (held by a booking).';

-- ---------------------------------------------------------------------
-- profiles: app data for each signed-in user (1 : 1 with auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text check (char_length(full_name) <= 80),
  phone         text check (phone ~ '^[0-9+ -]{6,20}$'),
  license_plate text check (char_length(license_plate) <= 20),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.profiles is 'One row per user. Created automatically when someone signs up (trigger on auth.users).';

-- ---------------------------------------------------------------------
-- bookings: a driver reserves one bay for a number of hours
-- ---------------------------------------------------------------------
create table public.bookings (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  spot_id         bigint not null references public.parking_spots (id),
  status          text not null check (status in ('pending_payment', 'active', 'completed', 'cancelled', 'expired')),
  duration_hours  integer not null check (duration_hours between 1 and 24),
  hourly_rate     numeric(8,2) not null check (hourly_rate >= 0),
  amount          numeric(10,2) not null check (amount >= 0),
  created_at      timestamptz not null default now(),
  hold_expires_at timestamptz,
  starts_at       timestamptz,
  ends_at         timestamptz,
  ended_at        timestamptz,
  constraint bookings_period_valid check (starts_at is null or ends_at is null or ends_at > starts_at),
  constraint bookings_active_has_period check (status <> 'active' or (starts_at is not null and ends_at is not null))
);
create index bookings_user_id_created_at_idx on public.bookings (user_id, created_at desc);
create index bookings_spot_id_idx on public.bookings (spot_id);
-- Integrity rules enforced by the database itself:
--   a bay can only have one live booking, and a driver can only hold one bay at a time.
create unique index bookings_one_live_per_spot on public.bookings (spot_id) where status in ('pending_payment', 'active');
create unique index bookings_one_live_per_user on public.bookings (user_id) where status in ('pending_payment', 'active');

comment on table public.bookings is 'Reservations. pending_payment (10 minute hold) -> active (paid) -> completed; or cancelled / expired.';
comment on column public.bookings.hourly_rate is 'Price per hour copied from the lot when the booking was made, so old bookings keep their price.';
comment on column public.bookings.amount is 'Total to pay in THB = hourly_rate x duration_hours, capped at the lot daily_max. Calculated in the database.';
comment on column public.bookings.hold_expires_at is 'An unpaid booking releases its bay at this time.';

-- ---------------------------------------------------------------------
-- payments: every payment attempt for a booking (1 booking : N attempts)
-- ---------------------------------------------------------------------
create table public.payments (
  id         bigint generated always as identity primary key,
  booking_id bigint not null references public.bookings (id) on delete cascade,
  amount     numeric(10,2) not null check (amount > 0),
  currency   text not null default 'THB' check (currency = 'THB'),
  method     text not null check (method in ('promptpay_qr', 'card')),
  provider   text not null default 'demo' check (provider = 'demo'),
  status     text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'cancelled')),
  reference  text not null unique,
  created_at timestamptz not null default now(),
  paid_at    timestamptz,
  constraint payments_paid_at_matches_status check ((status = 'succeeded') = (paid_at is not null))
);
create index payments_booking_id_idx on public.payments (booking_id);
create unique index payments_one_success_per_booking on public.payments (booking_id) where status = 'succeeded';

comment on table public.payments is 'Payment attempts. provider = demo: the checkout is simulated, no real money moves.';
comment on column public.payments.reference is 'Reference shown on the checkout screen and the receipt.';

-- ---------------------------------------------------------------------
-- availability_snapshots: raw sensor history (the "Data" layer of DIKW)
-- ---------------------------------------------------------------------
create table public.availability_snapshots (
  id              bigint generated always as identity primary key,
  lot_id          bigint not null references public.parking_lots (id) on delete cascade,
  recorded_at     timestamptz not null default now(),
  available_spots integer not null check (available_spots >= 0)
);
create index availability_snapshots_lot_recorded_idx on public.availability_snapshots (lot_id, recorded_at desc);
create index availability_snapshots_recorded_at_idx on public.availability_snapshots (recorded_at);

comment on table public.availability_snapshots is 'Time series of free spaces per lot, written by the sensor feed. Source for occupancy analytics.';

-- ---------------------------------------------------------------------
-- search_events: what signed-in drivers ask the assistant for
-- (only the intent is stored, never the words that were spoken)
-- ---------------------------------------------------------------------
create table public.search_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  source     text not null check (source in ('voice', 'text', 'chip')),
  intent     text not null check (intent in ('find_nearest', 'cheapest', 'free', 'ev', 'accessible', 'covered',
                                             'navigate', 'reserve', 'price_check', 'availability_check', 'other')),
  lot_id     bigint references public.parking_lots (id) on delete set null,
  created_at timestamptz not null default now()
);
create index search_events_user_id_created_at_idx on public.search_events (user_id, created_at desc);
create index search_events_lot_id_idx on public.search_events (lot_id);

comment on table public.search_events is 'Demand signals: the kind of request a driver made (intent) and the lot it led to. No transcript is stored.';

-- =====================================================================
-- Read models (views). security_invoker = true means the view obeys the
-- row level security of the person who queries it.
-- =====================================================================

-- Everything the map and list need about a lot, in one row.
create view public.lot_overview
with (security_invoker = true) as
select
  l.id,
  l.code,
  l.name,
  l.address,
  l.latitude,
  l.longitude,
  o.name as operator_name,
  l.total_spots,
  l.available_spots,
  round(100.0 * (l.total_spots - l.available_spots) / l.total_spots, 1) as occupancy_pct,
  l.hourly_rate,
  l.daily_max,
  l.open_time,
  l.close_time,
  l.ev_chargers,
  l.accessible_spots,
  l.is_covered,
  l.has_security,
  l.free_with_purchase,
  l.rating,
  l.availability_updated_at,
  (select count(*) from public.parking_spots s where s.lot_id = l.id and s.status = 'available') as bookable_bays_free
from public.parking_lots l
join public.operators o on o.id = l.operator_id
where l.is_active;

comment on view public.lot_overview is 'Lot + operator + current occupancy. Used by the map, the list and the voice assistant.';

-- A booking with its bay, lot and latest payment.
create view public.booking_details
with (security_invoker = true) as
select
  b.id,
  b.user_id,
  b.status,
  b.duration_hours,
  b.hourly_rate,
  b.amount,
  b.created_at,
  b.hold_expires_at,
  b.starts_at,
  b.ends_at,
  b.ended_at,
  s.id    as spot_id,
  s.label as spot_label,
  s.spot_type,
  l.id    as lot_id,
  l.code  as lot_code,
  l.name  as lot_name,
  p.id        as payment_id,
  p.method    as payment_method,
  p.status    as payment_status,
  p.reference as payment_reference,
  p.paid_at
from public.bookings b
join public.parking_spots s on s.id = b.spot_id
join public.parking_lots l on l.id = s.lot_id
left join lateral (
  select pay.id, pay.method, pay.status, pay.reference, pay.paid_at
  from public.payments pay
  where pay.booking_id = b.id
  order by (pay.status = 'succeeded') desc, pay.created_at desc, pay.id desc
  limit 1
) p on true;

comment on view public.booking_details is 'Booking joined with bay, lot and its latest payment. Drivers only see their own rows (RLS on bookings).';
