import type { DemoLot } from "./demo-lots";

const aliases: Record<string, string[]> = {
  sp: ["siam paragon", "paragon"],
  cw: ["central world", "centralworld", "central"],
  mbk: ["mbk"],
  ic: ["iconsiam", "icon siam"],
  eq: ["emquartier", "em quartier"],
  em: ["emporium"],
  t21: ["terminal 21", "terminal21", "asok", "asoke"],
  sil: ["silom"],
  ps: ["pantip"],
  bj: ["big c", "bigc"],
  ct: ["chamchuri", "chula"],
  bt: ["bts siam", "park and ride", "park & ride"],
  rs: ["river city"],
};

export function findLotByName(query: string, lots: DemoLot[]): DemoLot | null {
  const text = query.toLowerCase();
  let best: DemoLot | null = null;
  let bestScore = 0;
  for (const lot of lots) {
    let score = lot.name.toLowerCase().split(/[\s,]+/)
      .filter((token) => token.length > 3 && text.includes(token))
      .reduce((sum, token) => sum + token.length, 0);
    if (lot.id.length >= 2 && new RegExp(`\\b${lot.id}\\b`, "i").test(text)) score += 6;
    for (const alias of aliases[lot.id] ?? []) {
      if (text.includes(alias)) score += alias.length * 2;
    }
    if (score > bestScore) {
      best = lot;
      bestScore = score;
    }
  }
  return bestScore >= 4 ? best : null;
}

function extractNumber(text: string, units: string): number | null {
  const match = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${units}`, "i"));
  return match ? Number(match[1]) : null;
}

export function parseIntent(query: string, lots: DemoLot[]) {
  const text = query.toLowerCase();
  const lot = findLotByName(text, lots);
  const distanceKm = extractNumber(text, "(km|kilometers?|k)\\b");
  const distanceM = extractNumber(text, "(m|meters?|metres?)\\b");
  const navigate = /\b(navigate|take me|directions?|guide me|drive me|head to|go to|route to)\b/.test(text);
  return {
    lot,
    navigate,
    yes: /\b(yes|yeah|yep|yup|sure|okay|ok|go ahead|take me|lead the way|let'?s go|lets go|chai)\b|ไป|ใช่/.test(text),
    no: /\b(no|nope|don'?t|do not|not now|maybe later|cancel|stop|mai)\b|ไม่/.test(text),
    atLocation: !!lot && /(i'?m|i am|im|currently|am at|อยู่|from my)/.test(text) && !navigate,
    help: /\b(help|what can you do|commands?)\b/.test(text),
    repeat: /\b(repeat|say that again|come again)\b/.test(text),
    cancel: /\b(cancel|stop (navigation|it)|end navigation)\b/.test(text),
    greeting: /\b(hi|hello|hey|good (morning|afternoon|evening))\b/.test(text),
    reserve: /\b(reserve|book|hold|save (me )?a spot|spot for me)\b/.test(text),
    cheapest: /\b(cheapest|best price|best value|least expensive)\b/.test(text),
    priceQuery: /\b(how much|price|cost|rate)\b/.test(text),
    free: /\b(free|no charge|complimentary)\b/.test(text),
    ev: /\b(ev|electric|charge|charger|charging)\b/.test(text),
    disabled: /\b(disabled|handicap|wheelchair|accessible|accessibility)\b/.test(text),
    covered: /\b(covered|indoor|roof|shade)\b/.test(text),
    nearest: /\b(nearest|closest|near me|nearby|around me|any (free )?spot|find (a |parking)|where (can|to) park|parking)\b/.test(text),
    maxDistance: distanceM === null ? distanceKm : distanceM / 1000,
    maxPrice: extractNumber(text, "(baht|bht|฿|thb)\\b"),
    insights: /\b(insights?|dashboard|analytics|statistics|stats|dikw)\b/.test(text),
    account: /\b(my (account|profile|bookings?|history|receipts?|payments?)|sign ?in|log ?in)\b/.test(text),
    pay: /\b(pay( now)?|payment|check ?out)\b/.test(text) && !/\bhow much\b/.test(text),
  };
}

export type Intent = ReturnType<typeof parseIntent>;

/** The values public.search_events.intent accepts. */
export type SearchKind =
  | "find_nearest" | "cheapest" | "free" | "ev" | "accessible" | "covered"
  | "navigate" | "reserve" | "price_check" | "availability_check" | "other";

/** The kind of parking search to record as a demand signal. Only the kind is stored, never the words. */
export function searchKind(intent: Pick<Intent, "ev" | "disabled" | "covered" | "free" | "cheapest" | "nearest">): SearchKind {
  if (intent.ev) return "ev";
  if (intent.disabled) return "accessible";
  if (intent.covered) return "covered";
  if (intent.free) return "free";
  if (intent.cheapest) return "cheapest";
  return intent.nearest ? "find_nearest" : "other";
}
