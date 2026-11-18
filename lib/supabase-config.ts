// Where the SwapSpot database lives (Supabase: Postgres + sign-in).
//
// Both values are public by design. The publishable key only identifies the project; what a
// visitor may read or change is decided inside the database by row level security, so the
// key does not need to be kept secret. Never put a secret or service_role key here or in any
// NEXT_PUBLIC_ variable.
//
// To use another Supabase project, set the two variables from .env.example.
const DEFAULT_URL = "https://kjzkevytfnokhsortmgv.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_Goo5c7Sg6nBePWeut3fPaA_NKTUORri";

export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL,
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY,
};
