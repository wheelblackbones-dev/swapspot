import type { Lot } from "./parking";

// dbId and bookableFree are set when the lot was loaded from the database (see lib/lots.ts);
// the built-in sample lots below do not have them.
export type DemoLot = Lot & { daily: number; hours: string; addr: string; security: boolean; rating: number; op: string; freeWithPurchase?: boolean; dbId?: number; bookableFree?: number };

const demoLots: Omit<DemoLot, "avail">[] = [
  {id:'sp',  name:'Siam Paragon Garage',        lat:13.7464,lng:100.5340,total:2600,price:60, daily:300, hours:'10:00–22:00', addr:'991 Rama I Rd, Pathum Wan', ev:12, disabled:28, covered:true, security:true, rating:4.6, op:'Siam Piwat'},
  {id:'cw',  name:'CentralWorld Parking',       lat:13.7472,lng:100.5396,total:3100,price:50, daily:250, hours:'10:00–22:00', addr:'999/9 Rama I Rd, Pathum Wan', ev:8,  disabled:32, covered:true, security:true, rating:4.4, op:'Central Pattana'},
  {id:'mbk', name:'MBK Center Parking',         lat:13.7442,lng:100.5296,total:1800,price:40, daily:200, hours:'10:00–22:00', addr:'444 Phaya Thai Rd, Wang Mai', ev:4,  disabled:18, covered:true, security:true, rating:4.1, op:'MBK Group'},
  {id:'pf',  name:'Platinum Fashion Mall',      lat:13.7504,lng:100.5355,total:1200,price:40, daily:200, hours:'09:00–20:00', addr:'222 Phetchaburi Rd, Makkasan', ev:0,  disabled:10, covered:true, security:false,rating:3.9, op:'Platinum'},
  {id:'ic',  name:'ICONSIAM Parking',           lat:13.7264,lng:100.5088,total:3500,price:70, daily:350, hours:'10:00–22:00', addr:'299 Charoen Nakhon Rd, Khlong San', ev:20, disabled:40, covered:true, security:true, rating:4.8, op:'Siam Piwat'},
  {id:'eq',  name:'EmQuartier Parking',         lat:13.7308,lng:100.5680,total:2000,price:60, daily:300, hours:'10:00–22:00', addr:'693 Sukhumvit Rd, Khlong Tan', ev:10, disabled:22, covered:true, security:true, rating:4.5, op:'The Mall Group'},
  {id:'em',  name:'Emporium Parking',           lat:13.7310,lng:100.5655,total:1400,price:60, daily:300, hours:'10:00–22:00', addr:'622 Sukhumvit Rd, Khlong Tan', ev:6,  disabled:16, covered:true, security:true, rating:4.3, op:'The Mall Group'},
  {id:'t21', name:'Terminal 21 Asok',           lat:13.7370,lng:100.5600,total:1500,price:50, daily:250, hours:'10:00–22:00', addr:'88 Sukhumvit Rd, Khlong Toei', ev:6,  disabled:18, covered:true, security:true, rating:4.4, op:'Terminal 21'},
  {id:'sk',  name:'Sukhumvit 11 Street Parking',lat:13.7445,lng:100.5565,total:320, price:30, daily:150, hours:'24 hours',     addr:'Sukhumvit 11, Khlong Toei Nuea', ev:0, disabled:4,  covered:false,security:false,rating:3.6, op:'City Parking'},
  {id:'sil', name:'Silom Complex Garage',       lat:13.7270,lng:100.5270,total:900, price:50, daily:250, hours:'07:00–22:00', addr:'191 Silom Rd, Suriyawong', ev:4,  disabled:12, covered:true, security:true, rating:4.0, op:'Silom Complex'},
  {id:'ps',  name:'Pantip Plaza Parking',       lat:13.7530,lng:100.5320,total:700, price:40, daily:200, hours:'10:00–20:30', addr:'604 Phetchaburi Rd, Makkasan', ev:2,  disabled:8,  covered:true, security:false,rating:3.8, op:'Pantip'},
  {id:'bj',  name:'Big C Rajdamri',             lat:13.7448,lng:100.5380,total:800, price:0,  daily:0,   hours:'09:00–22:00', addr:'97/11 Rajdamri Rd, Pathum Wan', ev:0, disabled:10, covered:true, security:false,rating:4.0, op:'Big C', freeWithPurchase:true},
  {id:'ct',  name:'Chamchuri Square Garage',    lat:13.7335,lng:100.5310,total:1100,price:45, daily:220, hours:'06:00–24:00', addr:'254 Phaya Thai Rd, Pathum Wan', ev:4, disabled:14, covered:true, security:true, rating:4.2, op:'Chula'},
  {id:'mh',  name:'Mercure Bangkok Siam',       lat:13.7455,lng:100.5325,total:250, price:80, daily:400, hours:'24 hours',     addr:'420 Siam Square Soi 7', ev:2, disabled:6, covered:true, security:true, rating:4.1, op:'Mercure'},
  {id:'bt',  name:'BTS Siam Park & Ride',       lat:13.7458,lng:100.5333,total:450, price:20, daily:100, hours:'05:00–24:00', addr:'Rama I Rd, Pathum Wan', ev:0, disabled:6, covered:false,security:true, rating:3.9, op:'BTS'},
  {id:'rs',  name:'River City Bangkok',         lat:13.7315,lng:100.5110,total:600, price:50, daily:250, hours:'10:00–22:00', addr:'1 Trok Rongnamkhaeng, Yota Rd', ev:4, disabled:8, covered:true, security:true, rating:4.2, op:'River City'},
];

export function createDemoLots(): DemoLot[] {
  return demoLots.map((lot) => ({ ...lot, avail: Math.round(lot.total * 0.2) }));
}
