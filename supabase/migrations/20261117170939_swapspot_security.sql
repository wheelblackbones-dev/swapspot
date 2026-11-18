-- =====================================================================
-- SwapSpot · 03 · Security
-- Row level security (who can see which ROWS) and grants (who can touch
-- which TABLES / FUNCTIONS at all). Least privilege:
--
--   anon           visitors who are not signed in   -> read public parking data
--   authenticated  signed-in drivers                -> + their own profile, bookings, payments
--
-- Nobody can insert or update bookings / payments / bays directly.
-- Those changes only happen through the functions in 02.
-- =====================================================================

alter table public.operators              enable row level security;
alter table public.parking_lots           enable row level security;
alter table public.parking_spots          enable row level security;
alter table public.availability_snapshots enable row level security;
alter table public.profiles               enable row level security;
alter table public.bookings               enable row level security;
alter table public.payments               enable row level security;
alter table public.search_events          enable row level security;

-- ---------------------------------------------------------------------
-- Public reference data: anyone may read, nobody may write through the API
-- ---------------------------------------------------------------------
create policy "Anyone can read operators"
on public.operators for select
to anon, authenticated
using (true);

create policy "Anyone can read parking lots"
on public.parking_lots for select
to anon, authenticated
using (true);

create policy "Anyone can read parking spots"
on public.parking_spots for select
to anon, authenticated
using (true);

create policy "Anyone can read availability history"
on public.availability_snapshots for select
to anon, authenticated
using (true);

-- ---------------------------------------------------------------------
-- Personal data: a driver only ever sees their own rows
-- ---------------------------------------------------------------------
create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users can read their own bookings"
on public.bookings for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read payments for their own bookings"
on public.payments for select
to authenticated
using (exists (
  select 1 from public.bookings b
  where b.id = payments.booking_id
    and b.user_id = (select auth.uid())
));

create policy "Users can read their own search events"
on public.search_events for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can log their own search events"
on public.search_events for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- Grants. Start from nothing, then add exactly what the app needs.
-- (Written out explicitly so the result is the same whether or not the
--  project auto-exposes new tables to the Data API.)
-- ---------------------------------------------------------------------
revoke all on table
  public.operators, public.parking_lots, public.parking_spots, public.availability_snapshots,
  public.profiles, public.bookings, public.payments, public.search_events,
  public.lot_overview, public.booking_details
from anon, authenticated;

grant select on table
  public.operators, public.parking_lots, public.parking_spots, public.availability_snapshots,
  public.lot_overview
to anon, authenticated;

grant select on table
  public.profiles, public.bookings, public.payments, public.search_events, public.booking_details
to authenticated;

-- column-level: a driver may edit these profile fields and nothing else
grant update (full_name, phone, license_plate) on table public.profiles to authenticated;

-- column-level: user_id is filled in by the database (default auth.uid())
grant insert (source, intent, lot_id) on table public.search_events to authenticated;

-- ---------------------------------------------------------------------
-- Functions. Postgres lets everyone execute new functions by default,
-- so take that away first.
-- ---------------------------------------------------------------------
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function
  public.create_booking(bigint, integer),
  public.start_payment(bigint, text),
  public.confirm_demo_payment(bigint, text),
  public.cancel_booking(bigint),
  public.end_booking(bigint)
from public, anon, authenticated;

-- signed-in drivers may call the booking API ...
grant execute on function
  public.create_booking(bigint, integer),
  public.start_payment(bigint, text),
  public.confirm_demo_payment(bigint, text),
  public.cancel_booking(bigint),
  public.end_booking(bigint)
to authenticated;

-- ... and the wrappers need the matching private function
grant execute on function
  private.create_booking(bigint, integer),
  private.start_payment(bigint, text),
  private.confirm_demo_payment(bigint, text),
  private.cancel_booking(bigint),
  private.end_booking(bigint)
to authenticated;
