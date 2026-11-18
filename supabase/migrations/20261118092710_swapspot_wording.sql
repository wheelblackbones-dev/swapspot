-- SwapSpot — wording: the app says "spot" everywhere, so the tips the database writes say "spot" too.
--
-- Only four sentences change (driver tips and platform advice said "bay"). The view and the
-- two functions are otherwise the same as in 20261117171105_swapspot_dikw.sql; replacing them
-- in place keeps their grants.

create or replace view public.dikw_wisdom_lot_actions
with (security_invoker = true) as
select
  k.lot_id,
  k.lot_code,
  k.lot_name,
  k.demand_level,
  k.hourly_rate,
  case
    when k.demand_level = 'high' then 'raise_peak_price'
    when k.demand_level = 'low'  then 'promote_off_peak'
    else 'keep_price'
  end as operator_action,
  case
    when k.demand_level = 'high' then k.hourly_rate + 10
    when k.demand_level = 'low'  then greatest(k.hourly_rate - 10, 0)
    else k.hourly_rate
  end as suggested_rate,
  case
    when k.demand_level = 'high' then format(
      'Almost full at peak: %s%% occupied around %s. Test a peak-hour rate of ฿%s/hr (now ฿%s) and point drivers to quieter lots nearby.',
      round(k.peak_occupancy_pct), to_char(make_time(k.peak_hour, 0, 0), 'HH24:MI'),
      (k.hourly_rate + 10)::integer, k.hourly_rate::integer)
    when k.demand_level = 'low' and k.hourly_rate > 10 then format(
      'Under-used: only %s%% occupied at its busiest (%s). Promote it in search results or try an off-peak rate of ฿%s/hr (now ฿%s).',
      round(k.peak_occupancy_pct), to_char(make_time(k.peak_hour, 0, 0), 'HH24:MI'),
      (k.hourly_rate - 10)::integer, k.hourly_rate::integer)
    when k.demand_level = 'low' then format(
      'Under-used: only %s%% occupied at its busiest (%s). Promote it in search results as the low-cost choice.',
      round(k.peak_occupancy_pct), to_char(make_time(k.peak_hour, 0, 0), 'HH24:MI'))
    else format(
      'Healthy balance: peaks at %s%% around %s. Keep the current price and keep watching.',
      round(k.peak_occupancy_pct), to_char(make_time(k.peak_hour, 0, 0), 'HH24:MI'))
  end as operator_tip,
  format(
    'Busiest around %s (%s%% full). Easiest around %s (%s%% full).%s',
    to_char(make_time(k.peak_hour, 0, 0), 'HH24:MI'), round(k.peak_occupancy_pct),
    to_char(make_time(k.quiet_hour, 0, 0), 'HH24:MI'), round(k.quiet_occupancy_pct),
    case when k.demand_level = 'high' then ' Book a spot before you set off.' else '' end
  ) as driver_tip
from public.dikw_knowledge_lot_patterns k;

-- ---------------------------------------------------------------------
create or replace function private.platform_insights()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid            uuid := (select auth.uid());
  v_paid           integer;
  v_abandoned      integer;
  v_decided        integer;
  v_conversion     numeric;
  v_revenue        numeric;
  v_pay_ok         integer;
  v_pay_failed     integer;
  v_success_rate   numeric;
  v_searches       integer;
  v_top_intent     text;
  v_top_intent_n   integer;
  v_top_method     text;
  v_top_method_n   integer;
  v_busiest_hour   integer;
  v_top_lot        text;
  v_wisdom         jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'Please sign in to see platform insights.';
  end if;

  select count(*) filter (where status in ('active', 'completed') and amount > 0),
         count(*) filter (where status in ('cancelled', 'expired'))
  into v_paid, v_abandoned
  from public.bookings;
  v_decided := v_paid + v_abandoned;
  v_conversion := case when v_decided > 0 then round(v_paid::numeric / v_decided, 3) end;

  select coalesce(sum(amount) filter (where status = 'succeeded'), 0),
         count(*) filter (where status = 'succeeded'),
         count(*) filter (where status = 'failed')
  into v_revenue, v_pay_ok, v_pay_failed
  from public.payments;
  v_success_rate := case when v_pay_ok + v_pay_failed > 0
                         then round(v_pay_ok::numeric / (v_pay_ok + v_pay_failed), 3) end;

  select count(*) into v_searches from public.search_events;
  select intent, count(*)::integer into v_top_intent, v_top_intent_n
  from public.search_events group by intent order by count(*) desc, intent limit 1;

  select method, count(*)::integer into v_top_method, v_top_method_n
  from public.payments where status = 'succeeded' group by method order by count(*) desc, method limit 1;

  select extract(hour from (created_at at time zone 'Asia/Bangkok'))::integer into v_busiest_hour
  from public.bookings group by 1 order by count(*) desc, 1 limit 1;

  select l.name into v_top_lot
  from public.bookings b
  join public.parking_spots s on s.id = b.spot_id
  join public.parking_lots l on l.id = s.lot_id
  group by l.name order by count(*) desc, l.name limit 1;

  -- WISDOM: simple rules on top of the knowledge above
  if v_decided < 3 then
    v_wisdom := v_wisdom || jsonb_build_object(
      'title', 'Collect more bookings first',
      'detail', format('Only %s finished booking(s) so far. Revenue advice appears after a few more bookings.', v_decided));
  elsif v_conversion < 0.6 then
    v_wisdom := v_wisdom || jsonb_build_object(
      'title', 'Fix the drop-off at checkout',
      'detail', format('%s of %s holds were never paid (%s%% conversion). Shorten the payment step and remind drivers before the 10 minute hold ends.',
                       v_abandoned, v_decided, round(v_conversion * 100)));
  else
    v_wisdom := v_wisdom || jsonb_build_object(
      'title', 'Checkout is working',
      'detail', format('%s%% of holds turn into paid bookings. Keep the flow as it is and grow traffic instead.',
                       round(v_conversion * 100)));
  end if;

  if v_pay_ok + v_pay_failed >= 5 and v_success_rate < 0.8 then
    v_wisdom := v_wisdom || jsonb_build_object(
      'title', 'Too many failed payments',
      'detail', format('Only %s%% of payment attempts succeed. Offer a second method at the moment a payment fails.',
                       round(v_success_rate * 100)));
  end if;

  if v_pay_ok >= 3 and v_top_method_n::numeric / v_pay_ok >= 0.7 then
    v_wisdom := v_wisdom || jsonb_build_object(
      'title', format('Make %s the default', case v_top_method when 'promptpay_qr' then 'PromptPay QR' else 'card' end),
      'detail', format('%s%% of successful payments use it. Pre-select it at checkout to save a tap.',
                       round(100.0 * v_top_method_n / v_pay_ok)));
  end if;

  if v_searches >= 5 and v_top_intent_n::numeric / v_searches >= 0.3 then
    v_wisdom := v_wisdom || jsonb_build_object(
      'title', case v_top_intent
                 when 'cheapest'     then 'Drivers are price-sensitive'
                 when 'free'         then 'Drivers look for free parking'
                 when 'ev'           then 'EV demand is strong'
                 when 'accessible'   then 'Accessible parking is in demand'
                 when 'find_nearest' then 'Distance matters most'
                 when 'navigate'     then 'Drivers already know where they are going'
                 else 'Most common request: ' || replace(v_top_intent, '_', ' ')
               end,
      'detail', case v_top_intent
                 when 'cheapest'     then format('%s%% of requests ask for the cheapest option. Show price first and highlight lots under ฿40/hr.', round(100.0 * v_top_intent_n / v_searches))
                 when 'free'         then format('%s%% of requests ask for free parking. Partner with stores that validate parking.', round(100.0 * v_top_intent_n / v_searches))
                 when 'ev'           then format('%s%% of requests ask for EV charging. Add EV spots at lots that have none.', round(100.0 * v_top_intent_n / v_searches))
                 when 'accessible'   then format('%s%% of requests ask for accessible spots. Make them bookable at every lot.', round(100.0 * v_top_intent_n / v_searches))
                 when 'find_nearest' then format('%s%% of requests ask for the nearest parking. Rank nearby lots with free spaces first.', round(100.0 * v_top_intent_n / v_searches))
                 when 'navigate'     then format('%s%% of requests go straight to navigation. Offer a one-tap booking for the destination lot.', round(100.0 * v_top_intent_n / v_searches))
                 else format('%s%% of all requests. Make this the first thing drivers see.', round(100.0 * v_top_intent_n / v_searches))
               end);
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'data', jsonb_build_object(
      'operators',       (select count(*) from public.operators),
      'lots',            (select count(*) from public.parking_lots),
      'bays',            (select count(*) from public.parking_spots),
      'sensor_readings', (select count(*) from public.availability_snapshots),
      'users',           (select count(*) from public.profiles),
      'bookings',        (select count(*) from public.bookings),
      'payments',        (select count(*) from public.payments),
      'search_events',   v_searches
    ),
    'information', jsonb_build_object(
      'bookings_paid',        v_paid,
      'bookings_abandoned',   v_abandoned,
      'revenue',              v_revenue,
      'average_ticket',       case when v_pay_ok > 0 then round(v_revenue / v_pay_ok, 2) end,
      'average_hours',        (select round(avg(duration_hours), 1) from public.bookings where status in ('active', 'completed')),
      'payment_success_rate', v_success_rate,
      'by_method', coalesce((
        select jsonb_agg(jsonb_build_object('method', m.method, 'payments', m.n, 'amount', m.total) order by m.total desc)
        from (select method, count(*) as n, sum(amount) as total
              from public.payments where status = 'succeeded' group by method) m), '[]'::jsonb),
      'by_lot', coalesce((
        select jsonb_agg(jsonb_build_object('lot_name', t.name, 'bookings', t.n, 'revenue', t.total) order by t.total desc, t.n desc)
        from (select l.name, count(*) as n, coalesce(sum(b.amount), 0) as total
              from public.bookings b
              join public.parking_spots s on s.id = b.spot_id
              join public.parking_lots l on l.id = s.lot_id
              where b.status in ('active', 'completed')
              group by l.name order by 3 desc, 2 desc limit 5) t), '[]'::jsonb),
      'by_intent', coalesce((
        select jsonb_agg(jsonb_build_object('intent', i.intent, 'searches', i.n) order by i.n desc)
        from (select intent, count(*) as n from public.search_events group by intent) i), '[]'::jsonb),
      'by_source', coalesce((
        select jsonb_agg(jsonb_build_object('source', c.source, 'searches', c.n) order by c.n desc)
        from (select source, count(*) as n from public.search_events group by source) c), '[]'::jsonb)
    ),
    'knowledge', jsonb_build_object(
      'conversion_rate',        v_conversion,
      'busiest_booking_hour',   v_busiest_hour,
      'top_lot',                v_top_lot,
      'top_intent',             v_top_intent,
      'top_intent_share',       case when v_searches > 0 then round(v_top_intent_n::numeric / v_searches, 3) end,
      'preferred_method',       v_top_method,
      'preferred_method_share', case when v_pay_ok > 0 then round(v_top_method_n::numeric / v_pay_ok, 3) end
    ),
    'wisdom', v_wisdom
  );
end;
$$;

-- ---------------------------------------------------------------------
create or replace function public.get_my_insights()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid          uuid := (select auth.uid());
  v_bookings     integer;
  v_paid         integer;
  v_spent        numeric;
  v_hours        integer;
  v_payments     integer;
  v_searches     integer;
  v_top_intent   text;
  -- favourite lot
  v_fav_id       bigint;
  v_fav_name     text;
  v_fav_rate     numeric;
  v_fav_lat      numeric;
  v_fav_lng      numeric;
  v_fav_visits   integer;
  v_peak_hour    integer;
  v_peak_pct     numeric;
  v_quiet_hour   integer;
  v_quiet_pct    numeric;
  -- cheaper lot near the favourite one
  v_alt_name     text;
  v_alt_rate     numeric;
  v_alt_metres   numeric;
  -- habits
  v_usual_hour   integer;
  v_weekend_n    integer;
  -- city-wide pattern (daytime)
  v_busy_hour    integer;
  v_busy_pct     numeric;
  v_calm_hour    integer;
  v_calm_pct     numeric;
  v_at_peak      boolean := false;
  v_wisdom       jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'Please sign in to see your insights.';
  end if;

  -- DATA / INFORMATION: my own rows
  select count(*),
         count(*) filter (where status in ('active', 'completed')),
         coalesce(sum(duration_hours) filter (where status in ('active', 'completed')), 0)
  into v_bookings, v_paid, v_hours
  from public.bookings
  where user_id = v_uid;

  select count(*), coalesce(sum(p.amount) filter (where p.status = 'succeeded'), 0)
  into v_payments, v_spent
  from public.payments p
  join public.bookings b on b.id = p.booking_id
  where b.user_id = v_uid;

  select count(*) into v_searches from public.search_events where user_id = v_uid;

  select intent into v_top_intent
  from public.search_events
  where user_id = v_uid
  group by intent
  order by count(*) desc, intent
  limit 1;

  -- KNOWLEDGE: favourite lot (most bookings, newest first on a tie) and usual time
  select l.id, l.name, l.hourly_rate, l.latitude, l.longitude, count(*)::integer
  into v_fav_id, v_fav_name, v_fav_rate, v_fav_lat, v_fav_lng, v_fav_visits
  from public.bookings b
  join public.parking_spots s on s.id = b.spot_id
  join public.parking_lots l on l.id = s.lot_id
  where b.user_id = v_uid and b.status in ('active', 'completed')
  group by l.id, l.name, l.hourly_rate, l.latitude, l.longitude
  order by count(*) desc, max(b.created_at) desc
  limit 1;

  select extract(hour from (created_at at time zone 'Asia/Bangkok'))::integer
  into v_usual_hour
  from public.bookings
  where user_id = v_uid and status in ('active', 'completed')
  group by 1
  order by count(*) desc, 1
  limit 1;

  select count(*) filter (where extract(isodow from (created_at at time zone 'Asia/Bangkok')) >= 6)
  into v_weekend_n
  from public.bookings
  where user_id = v_uid and status in ('active', 'completed');

  select hour_of_day, avg_occupancy_pct into v_busy_hour, v_busy_pct
  from public.dikw_information_city_hourly
  where hour_of_day between 8 and 21
  order by avg_occupancy_pct desc, hour_of_day
  limit 1;

  select hour_of_day, avg_occupancy_pct into v_calm_hour, v_calm_pct
  from public.dikw_information_city_hourly
  where hour_of_day between 8 and 21
  order by avg_occupancy_pct asc, hour_of_day
  limit 1;

  -- WISDOM: rules that combine my habits with the public occupancy patterns
  if v_fav_id is not null then
    select peak_hour, peak_occupancy_pct, quiet_hour, quiet_occupancy_pct
    into v_peak_hour, v_peak_pct, v_quiet_hour, v_quiet_pct
    from public.dikw_knowledge_lot_patterns
    where lot_id = v_fav_id;

    if v_peak_hour is not null then
      v_at_peak := v_usual_hour is not null and abs(v_usual_hour - v_peak_hour) <= 1;
      v_wisdom := v_wisdom || jsonb_build_object(
        'title', case when v_at_peak then 'You arrive at the busiest hour' else 'Best time for your usual lot' end,
        'detail', format('%s is busiest around %s (%s%% full) and easiest around %s (%s%% full).%s',
                         v_fav_name,
                         to_char(make_time(v_peak_hour, 0, 0), 'HH24:MI'), round(v_peak_pct),
                         to_char(make_time(v_quiet_hour, 0, 0), 'HH24:MI'), round(v_quiet_pct),
                         case when v_at_peak then ' Book a spot before you set off, or come an hour or two earlier.' else '' end));
    end if;

    -- a cheaper lot within about 1.5 km of the favourite one (haversine distance)
    select l.name, l.hourly_rate, d.metres
    into v_alt_name, v_alt_rate, v_alt_metres
    from public.parking_lots l
    cross join lateral (
      select 2 * 6371000 * asin(sqrt(
               power(sin(radians(l.latitude - v_fav_lat) / 2), 2)
               + cos(radians(v_fav_lat)) * cos(radians(l.latitude))
                 * power(sin(radians(l.longitude - v_fav_lng) / 2), 2))) as metres
    ) d
    where l.is_active and l.id <> v_fav_id and l.hourly_rate < v_fav_rate and d.metres <= 1500
    order by l.hourly_rate, d.metres
    limit 1;

    if v_alt_name is not null then
      v_wisdom := v_wisdom || jsonb_build_object(
        'title', format('Save ฿%s per hour', (v_fav_rate - v_alt_rate)::integer),
        'detail', format('%s is about %s m from %s and costs %s.',
                         v_alt_name, (round(v_alt_metres / 10) * 10)::integer, v_fav_name,
                         case when v_alt_rate = 0 then 'nothing with a purchase'
                              else format('฿%s/hr instead of ฿%s/hr', v_alt_rate::integer, v_fav_rate::integer) end));
    end if;
  end if;

  if v_paid = 0 and v_busy_hour is not null then
    v_wisdom := v_wisdom || jsonb_build_object(
      'title', 'Plan around the rush',
      'detail', format('No bookings yet. City-wide, parking is hardest around %s (%s%% full) and easiest around %s (%s%% full).',
                       to_char(make_time(v_busy_hour, 0, 0), 'HH24:MI'), round(v_busy_pct),
                       to_char(make_time(v_calm_hour, 0, 0), 'HH24:MI'), round(v_calm_pct)));
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'data', jsonb_build_object(
      'bookings',      v_bookings,
      'payments',      v_payments,
      'search_events', v_searches
    ),
    'information', jsonb_build_object(
      'bookings_paid',        v_paid,
      'total_spent',          v_spent,
      'hours_booked',         v_hours,
      'average_ticket',       case when v_paid > 0 then round(v_spent / v_paid, 2) end,
      'favourite_lot',        v_fav_name,
      'favourite_lot_visits', v_fav_visits
    ),
    'knowledge', jsonb_build_object(
      'usual_hour',                   v_usual_hour,
      'usual_day_type',               case when v_paid = 0 then null
                                           when v_weekend_n * 2 > v_paid then 'weekend'
                                           else 'weekday' end,
      'top_intent',                   v_top_intent,
      'favourite_peak_hour',          v_peak_hour,
      'favourite_peak_occupancy_pct', v_peak_pct,
      'favourite_quiet_hour',         v_quiet_hour,
      'city_busiest_hour',            v_busy_hour,
      'city_quietest_hour',           v_calm_hour
    ),
    'wisdom', v_wisdom
  );
end;
$$;
