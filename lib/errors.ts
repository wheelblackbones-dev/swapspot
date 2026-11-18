// Turns database and sign-in errors into sentences a driver can read.
// Messages raised by the SwapSpot database functions are already written for drivers
// ("Spot P3 was just taken. Please pick another one."), so they pass through unchanged.

export const ALREADY_REGISTERED = "This email already has an account. Sign in instead.";

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: "Wrong email or password.",
  email_not_confirmed: "Please confirm your email first. Check your inbox for the link.",
  user_already_exists: ALREADY_REGISTERED,
  email_exists: ALREADY_REGISTERED,
  weak_password: "Password must be at least 6 characters.",
  over_email_send_rate_limit: "Too many emails were sent just now. Try again in a few minutes.",
  over_request_rate_limit: "Too many attempts. Wait a moment and try again.",
  email_address_invalid: "That email address does not look right.",
  validation_failed: "That email address does not look right.",
  signup_disabled: "New accounts are switched off for this project.",
  email_address_not_authorized:
    "This project cannot send a confirmation email to that address yet. Ask the owner to turn off “Confirm email” in Supabase.",
};

function field(error: unknown, key: "message" | "code"): string {
  if (error && typeof error === "object" && key in error) {
    const value = (error as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
  }
  return "";
}

export function readableError(error: unknown): string {
  if (!error) return "Something went wrong.";
  const message = field(error, "message") || (typeof error === "string" ? error : "");
  const code = field(error, "code");
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return "Cannot reach the SwapSpot database. Check your connection and try again.";
  }
  if (code && AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];
  if (code === "42501") return "Please sign in first.";
  if (code === "PGRST301" || /jwt expired/i.test(message)) return "Your session ended. Please sign in again.";
  return message || "Something went wrong.";
}

/** Saving the profile can break a database CHECK constraint (code 23514). */
export function profileError(error: unknown): string {
  if (field(error, "code") === "23514") {
    return /phone/.test(field(error, "message"))
      ? "Phone can only contain digits, spaces, + and - (6 to 20 characters)."
      : "One of the fields is too long.";
  }
  return readableError(error);
}
