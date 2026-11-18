-- =====================================================================
-- SwapSpot · 02 · Functions and triggers
--
-- Business rules run inside the database so the browser can never set
-- a price, mark a payment as paid, or take a bay that is already taken.
--
--   private.*  security definer  -> the real logic, not reachable from the API
--   public.*   security invoker  -> thin wrappers the app calls with supabase.rpc()
--
-- Every private function checks auth.uid() itself.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger parking_spots_set_updated_at
before update on public.parking_spots
for each row execute function private.set_updated_at();

-- A new account in Supabase Auth automatically gets a profile row.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 80), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------
-- Simulated sensor feed
-- ---------------------------------------------------------------------

-- How full a lot normally is at a given moment (0..1).
-- Two demand peaks (lunch about 13:00, evening about 18:30, Bangkok time),
-- busier at weekends, scaled by how popular the lot is.
create function private.expected_occupancy(p_lot public.parking_lots, p_at timestamptz)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
  v_local   timestamp := p_at at time zone 'Asia/Bangkok';
  v_hour    numeric   := extract(hour from v_local) + extract(minute from v_local) / 60.0;
  v_weekend boolean   := extract(isodow from v_local) >= 6;
  v_open    boolean   := v_local::time >= p_lot.open_time and v_local::time < p_lot.close_time;
  v_level   numeric;
  v_popular numeric;
begin
  v_level := 0.18
           + 0.42 * exp(-power((v_hour - 13.0) / 2.2, 2))
           + 0.62 * exp(-power((v_hour - 18.5) / 2.0, 2));
  if v_weekend then
    v_level := v_level + 0.04 + 0.10 * exp(-power((v_hour - 15.5) / 3.5, 2));
  end if;

  -- rating 3.6 -> 0.62 ... rating 4.8 -> 1.22, plus a small fixed difference per lot
  v_popular := 0.5 * coalesce(p_lot.rating, 4.0) - 1.18 + ((p_lot.id * 37) % 9 - 4) / 100.0;
  v_level := v_level * v_popular;

  if p_lot.hourly_rate = 0 then
    v_level := v_level + 0.08;            -- free lots fill up faster
  end if;
  if not v_open then
    v_level := least(v_level, 0.08);      -- closed: only cars left overnight
  end if;

  return greatest(0.03, least(0.97, v_level));
end;
$$;

-- Releases bays whose booking is over. Safe to run at any time, by anyone's request.
create function private.housekeeping()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- unpaid holds that ran out of time
  with expired as (
    update public.bookings
    set status = 'expired', ended_at = now()
    where status = 'pending_payment' and hold_expires_at < now()
    returning id, spot_id
  ),
  cancelled_payments as (
    update public.payments p
    set status = 'cancelled'
    from expired e
    where p.booking_id = e.id and p.status = 'pending'
  )
  update public.parking_spots s
  set status = 'available'
  from expired e
  where s.id = e.spot_id and s.status = 'reserved';

  -- paid sessions whose time is up
  with finished as (
    update public.bookings
    set status = 'completed', ended_at = ends_at
    where status = 'active' and ends_at < now()
    returning spot_id
  )
  update public.parking_spots s
  set status = 'available'
  from finished f
  where s.id = f.spot_id and s.status = 'reserved';
end;
$$;

-- One tick of the simulated sensors. Scheduled every minute with pg_cron (see 06).
create function private.sensor_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
begin
  -- 1) each lot drifts toward its usual level for this time of day, with some noise
  update public.parking_lots l
  set available_spots = greatest(0, least(l.total_spots, round(
          l.available_spots
          + 0.25 * (l.total_spots * (1 - private.expected_occupancy(l, v_now)) - l.available_spots)
          + (random() - 0.5) * greatest(4, l.total_spots * 0.012)
        )::integer)),
      availability_updated_at = v_now
  where l.is_active;

  -- 2) walk-in cars arrive at / leave the bookable bays (reserved bays are never touched)
  update public.parking_spots s
  set status = case
                 when random() < least(0.65, private.expected_occupancy(l, v_now)) then 'occupied'
                 else 'available'
               end
  from public.parking_lots l
  where l.id = s.lot_id
    and s.status <> 'reserved'
    and random() < 0.12;

  -- 3) every 10 minutes keep one reading per lot as history
  if not exists (
    select 1 from public.availability_snapshots
    where recorded_at > v_now - interval '9 minutes 30 seconds'
  ) then
    insert into public.availability_snapshots (lot_id, recorded_at, available_spots)
    select id, v_now, available_spots
    from public.parking_lots
    where is_active;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Booking and payment logic
-- ---------------------------------------------------------------------
create function private.booking_json(p_booking_id bigint)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select to_jsonb(d) from public.booking_details d where d.id = p_booking_id;
$$;

-- Reserve a bay. Paid lots: 10 minute hold until payment. Free lots: active at once.
create function private.create_booking(p_spot_id bigint, p_hours integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_spot    public.parking_spots;
  v_lot     public.parking_lots;
  v_amount  numeric(10,2);
  v_free    boolean;
  v_booking public.bookings;
begin
  if v_uid is null then
    raise exception 'Please sign in to book a spot.';
  end if;
  if p_hours is null or p_hours < 1 or p_hours > 24 then
    raise exception 'Duration must be between 1 and 24 hours.';
  end if;

  perform private.housekeeping();

  if exists (select 1 from public.bookings
             where user_id = v_uid and status in ('pending_payment', 'active')) then
    raise exception 'You already have a booking in progress. Finish or cancel it first.';
  end if;

  -- lock the bay so two drivers cannot take it at the same moment
  select * into v_spot from public.parking_spots where id = p_spot_id for update;
  if not found then
    raise exception 'That spot does not exist.';
  end if;
  if v_spot.status <> 'available' then
    raise exception 'Spot % was just taken. Please pick another one.', v_spot.label;
  end if;

  select * into v_lot from public.parking_lots where id = v_spot.lot_id;
  if not v_lot.is_active then
    raise exception 'This lot is not taking bookings right now.';
  end if;

  -- the price is always calculated here, never sent by the browser
  v_amount := v_lot.hourly_rate * p_hours;
  if v_lot.daily_max is not null then
    v_amount := least(v_amount, v_lot.daily_max);
  end if;
  v_free := (v_amount = 0);

  insert into public.bookings
    (user_id, spot_id, status, duration_hours, hourly_rate, amount, hold_expires_at, starts_at, ends_at)
  values
    (v_uid, p_spot_id,
     case when v_free then 'active' else 'pending_payment' end,
     p_hours, v_lot.hourly_rate, v_amount,
     case when v_free then null else now() + interval '10 minutes' end,
     case when v_free then now() end,
     case when v_free then now() + make_interval(hours => p_hours) end)
  returning * into v_booking;

  update public.parking_spots set status = 'reserved' where id = p_spot_id;

  return private.booking_json(v_booking.id);
exception
  when unique_violation then
    raise exception 'That spot or your account already has a booking in progress.';
end;
$$;

-- Open a payment attempt for a booking that is waiting for payment.
create function private.start_payment(p_booking_id bigint, p_method text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_booking public.bookings;
  v_payment public.payments;
begin
  if v_uid is null then
    raise exception 'Please sign in first.';
  end if;
  if p_method is null or p_method not in ('promptpay_qr', 'card') then
    raise exception 'Unknown payment method.';
  end if;

  perform private.housekeeping();

  select * into v_booking from public.bookings
  where id = p_booking_id and user_id = v_uid
  for update;
  if not found then
    raise exception 'Booking not found.';
  end if;
  if v_booking.status = 'expired' then
    raise exception 'Your 10 minute hold ran out. Please book the spot again.';
  end if;
  if v_booking.status <> 'pending_payment' then
    raise exception 'This booking is not waiting for a payment.';
  end if;

  -- switching method replaces the previous unfinished attempt
  update public.payments set status = 'cancelled'
  where booking_id = p_booking_id and status = 'pending';

  insert into public.payments (booking_id, amount, method, reference)
  values (p_booking_id, v_booking.amount, p_method,
          'SWP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)))
  returning * into v_payment;

  return to_jsonb(v_payment);
end;
$$;

-- Finish a DEMO payment. There is no payment gateway: the outcome is chosen on the
-- checkout screen ('succeeded' or 'failed') so both paths can be demonstrated.
create function private.confirm_demo_payment(p_payment_id bigint, p_outcome text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_booking public.bookings;
  v_payment public.payments;
begin
  if v_uid is null then
    raise exception 'Please sign in first.';
  end if;
  if p_outcome is null or p_outcome not in ('succeeded', 'failed') then
    raise exception 'Outcome must be succeeded or failed.';
  end if;

  perform private.housekeeping();

  -- same lock order everywhere: booking first, then payment
  select b.* into v_booking
  from public.bookings b
  join public.payments p on p.booking_id = b.id
  where p.id = p_payment_id and b.user_id = v_uid
  for update of b;
  if not found then
    raise exception 'Payment not found.';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;

  -- a second tap on "Pay" must not fail or charge twice: just return the paid booking
  if v_payment.status = 'succeeded' then
    return private.booking_json(v_booking.id);
  end if;
  if v_booking.status = 'expired' then
    raise exception 'Your 10 minute hold ran out. Please book the spot again.';
  end if;
  if v_payment.status <> 'pending' then
    raise exception 'This payment is already %.', v_payment.status;
  end if;
  if v_booking.status <> 'pending_payment' then
    raise exception 'This booking is not waiting for a payment.';
  end if;

  if p_outcome = 'failed' then
    update public.payments set status = 'failed' where id = p_payment_id;
  else
    update public.payments set status = 'succeeded', paid_at = now() where id = p_payment_id;
    update public.bookings
    set status = 'active',
        starts_at = now(),
        ends_at = now() + make_interval(hours => duration_hours)
    where id = v_booking.id;
  end if;

  return private.booking_json(v_booking.id);
end;
$$;

-- Give up an unpaid booking and release the bay.
create function private.cancel_booking(p_booking_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_booking public.bookings;
begin
  if v_uid is null then
    raise exception 'Please sign in first.';
  end if;

  select * into v_booking from public.bookings
  where id = p_booking_id and user_id = v_uid
  for update;
  if not found then
    raise exception 'Booking not found.';
  end if;
  if v_booking.status = 'active' then
    raise exception 'A paid booking cannot be cancelled. End the parking session instead.';
  end if;

  if v_booking.status = 'pending_payment' then
    update public.bookings set status = 'cancelled', ended_at = now() where id = p_booking_id;
    update public.payments set status = 'cancelled' where booking_id = p_booking_id and status = 'pending';
    update public.parking_spots set status = 'available' where id = v_booking.spot_id and status = 'reserved';
  end if;

  return private.booking_json(p_booking_id);
end;
$$;

-- Leave early: close an active session and release the bay.
create function private.end_booking(p_booking_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_booking public.bookings;
begin
  if v_uid is null then
    raise exception 'Please sign in first.';
  end if;

  select * into v_booking from public.bookings
  where id = p_booking_id and user_id = v_uid
  for update;
  if not found then
    raise exception 'Booking not found.';
  end if;

  if v_booking.status = 'active' then
    update public.bookings
    set status = 'completed', ended_at = least(now(), ends_at)
    where id = p_booking_id;
    update public.parking_spots set status = 'available' where id = v_booking.spot_id and status = 'reserved';
  elsif v_booking.status = 'pending_payment' then
    raise exception 'This booking has not been paid yet. Cancel it instead.';
  end if;

  return private.booking_json(p_booking_id);
end;
$$;

-- ---------------------------------------------------------------------
-- Public API (what the app calls)
-- ---------------------------------------------------------------------
create function public.create_booking(p_spot_id bigint, p_hours integer)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.create_booking(p_spot_id, p_hours); $$;

create function public.start_payment(p_booking_id bigint, p_method text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.start_payment(p_booking_id, p_method); $$;

create function public.confirm_demo_payment(p_payment_id bigint, p_outcome text default 'succeeded')
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.confirm_demo_payment(p_payment_id, p_outcome); $$;

create function public.cancel_booking(p_booking_id bigint)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.cancel_booking(p_booking_id); $$;

create function public.end_booking(p_booking_id bigint)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.end_booking(p_booking_id); $$;

comment on function public.create_booking(bigint, integer) is 'Reserve a bay for N hours. Returns the booking as JSON.';
comment on function public.start_payment(bigint, text) is 'Open a payment attempt (promptpay_qr or card) for an unpaid booking.';
comment on function public.confirm_demo_payment(bigint, text) is 'Simulated checkout: mark a pending payment as succeeded or failed.';
comment on function public.cancel_booking(bigint) is 'Cancel an unpaid booking and release the bay.';
comment on function public.end_booking(bigint) is 'End an active parking session early and release the bay.';
