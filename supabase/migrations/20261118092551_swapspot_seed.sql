-- =====================================================================
-- SwapSpot · 05 · Seed data
-- The 16 demo lots in central Bangkok (the same ones the app shipped with),
-- 12 bookable bays per lot, and 14 days of hourly sensor history so the
-- DIKW views have something to analyse from day one.
--
-- Availability numbers are SIMULATED (see private.expected_occupancy).
-- =====================================================================

insert into public.operators (name) values
  ('Siam Piwat'), ('Central Pattana'), ('MBK Group'), ('Platinum'), ('The Mall Group'),
  ('Terminal 21'), ('City Parking'), ('Silom Complex'), ('Pantip'), ('Big C'),
  ('Chula'), ('Mercure'), ('BTS'), ('River City');

insert into public.parking_lots
  (code, operator_id, name, address, latitude, longitude, total_spots, available_spots,
   hourly_rate, daily_max, open_time, close_time, ev_chargers, accessible_spots,
   is_covered, has_security, free_with_purchase, rating)
select
  v.code, o.id, v.name, v.address, v.lat, v.lng, v.total, v.total,
  v.rate, v.daily, v.open_t, v.close_t, v.ev, v.accessible,
  v.covered, v.security, v.free_with_purchase, v.rating
from (values
  ( 1, 'sp',  'Siam Piwat',      'Siam Paragon Garage',         '991 Rama I Rd, Pathum Wan',         13.7464, 100.5340, 2600, 60, 300,  time '10:00', time '22:00', 12, 28, true,  true,  false, 4.6),
  ( 2, 'cw',  'Central Pattana', 'CentralWorld Parking',        '999/9 Rama I Rd, Pathum Wan',       13.7472, 100.5396, 3100, 50, 250,  time '10:00', time '22:00',  8, 32, true,  true,  false, 4.4),
  ( 3, 'mbk', 'MBK Group',       'MBK Center Parking',          '444 Phaya Thai Rd, Wang Mai',       13.7442, 100.5296, 1800, 40, 200,  time '10:00', time '22:00',  4, 18, true,  true,  false, 4.1),
  ( 4, 'pf',  'Platinum',        'Platinum Fashion Mall',       '222 Phetchaburi Rd, Makkasan',      13.7504, 100.5355, 1200, 40, 200,  time '09:00', time '20:00',  0, 10, true,  false, false, 3.9),
  ( 5, 'ic',  'Siam Piwat',      'ICONSIAM Parking',            '299 Charoen Nakhon Rd, Khlong San', 13.7264, 100.5088, 3500, 70, 350,  time '10:00', time '22:00', 20, 40, true,  true,  false, 4.8),
  ( 6, 'eq',  'The Mall Group',  'EmQuartier Parking',          '693 Sukhumvit Rd, Khlong Tan',      13.7308, 100.5680, 2000, 60, 300,  time '10:00', time '22:00', 10, 22, true,  true,  false, 4.5),
  ( 7, 'em',  'The Mall Group',  'Emporium Parking',            '622 Sukhumvit Rd, Khlong Tan',      13.7310, 100.5655, 1400, 60, 300,  time '10:00', time '22:00',  6, 16, true,  true,  false, 4.3),
  ( 8, 't21', 'Terminal 21',     'Terminal 21 Asok',            '88 Sukhumvit Rd, Khlong Toei',      13.7370, 100.5600, 1500, 50, 250,  time '10:00', time '22:00',  6, 18, true,  true,  false, 4.4),
  ( 9, 'sk',  'City Parking',    'Sukhumvit 11 Street Parking', 'Sukhumvit 11, Khlong Toei Nuea',    13.7445, 100.5565,  320, 30, 150,  time '00:00', time '24:00',  0,  4, false, false, false, 3.6),
  (10, 'sil', 'Silom Complex',   'Silom Complex Garage',        '191 Silom Rd, Suriyawong',          13.7270, 100.5270,  900, 50, 250,  time '07:00', time '22:00',  4, 12, true,  true,  false, 4.0),
  (11, 'ps',  'Pantip',          'Pantip Plaza Parking',        '604 Phetchaburi Rd, Makkasan',      13.7530, 100.5320,  700, 40, 200,  time '10:00', time '20:30',  2,  8, true,  false, false, 3.8),
  (12, 'bj',  'Big C',           'Big C Rajdamri',              '97/11 Rajdamri Rd, Pathum Wan',     13.7448, 100.5380,  800,  0, null, time '09:00', time '22:00',  0, 10, true,  false, true,  4.0),
  (13, 'ct',  'Chula',           'Chamchuri Square Garage',     '254 Phaya Thai Rd, Pathum Wan',     13.7335, 100.5310, 1100, 45, 220,  time '06:00', time '24:00',  4, 14, true,  true,  false, 4.2),
  (14, 'mh',  'Mercure',         'Mercure Bangkok Siam',        '420 Siam Square Soi 7',             13.7455, 100.5325,  250, 80, 400,  time '00:00', time '24:00',  2,  6, true,  true,  false, 4.1),
  (15, 'bt',  'BTS',             'BTS Siam Park & Ride',        'Rama I Rd, Pathum Wan',             13.7458, 100.5333,  450, 20, 100,  time '05:00', time '24:00',  0,  6, false, true,  false, 3.9),
  (16, 'rs',  'River City',      'River City Bangkok',          '1 Trok Rongnamkhaeng, Yota Rd',     13.7315, 100.5110,  600, 50, 250,  time '10:00', time '22:00',  4,  8, true,  true,  false, 4.2)
) as v(ord, code, operator, name, address, lat, lng, total, rate, daily, open_t, close_t,
       ev, accessible, covered, security, free_with_purchase, rating)
join public.operators o on o.name = v.operator
order by v.ord;

-- start every lot at its usual level for the current time of day
update public.parking_lots l
set available_spots = round(l.total_spots * (1 - private.expected_occupancy(l, now())))::integer;

-- 12 bookable bays per lot: P11 is an EV bay and P12 an accessible bay where the lot has them
insert into public.parking_spots (lot_id, label, spot_type, status)
select
  l.id,
  'P' || n,
  case
    when n = 11 and l.ev_chargers > 0 then 'ev'
    when n = 12 and l.accessible_spots > 0 then 'accessible'
    else 'standard'
  end,
  case
    when random() < least(0.65, private.expected_occupancy(l, now())) then 'occupied'
    else 'available'
  end
from public.parking_lots l
cross join generate_series(1, 12) as n
order by l.id, n;

-- 14 days of hourly readings per lot (16 lots x 337 hours = 5,392 rows)
insert into public.availability_snapshots (lot_id, recorded_at, available_spots)
select
  l.id,
  t.ts,
  round(l.total_spots * (1 - least(0.99, greatest(0.02,
        private.expected_occupancy(l, t.ts) + (random() - 0.5) * 0.10))))::integer
from public.parking_lots l
cross join generate_series(
  date_trunc('hour', now()) - interval '14 days',
  date_trunc('hour', now()),
  interval '1 hour'
) as t(ts)
order by t.ts, l.id;
