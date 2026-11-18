import assert from "node:assert/strict";
import test from "node:test";
import { ALREADY_REGISTERED, profileError, readableError } from "../lib/errors";

test("sign-in error codes become plain sentences", () => {
  assert.equal(readableError({ code: "invalid_credentials", message: "Invalid login credentials" }), "Wrong email or password.");
  assert.equal(readableError({ code: "user_already_exists", message: "User already registered" }), ALREADY_REGISTERED);
  assert.match(readableError({ code: "email_not_confirmed", message: "Email not confirmed" }), /confirm your email/);
});

test("network and permission problems are explained", () => {
  assert.match(readableError(new TypeError("Failed to fetch")), /Cannot reach the SwapSpot database/);
  assert.equal(readableError({ code: "42501", message: "permission denied for table bookings" }), "Please sign in first.");
  assert.match(readableError({ code: "PGRST301", message: "JWT expired" }), /sign in again/);
});

test("messages written by the database functions pass through unchanged", () => {
  assert.equal(readableError({ code: "P0001", message: "Spot P3 was just taken. Please pick another one." }), "Spot P3 was just taken. Please pick another one.");
  assert.equal(readableError(null), "Something went wrong.");
});

test("profile constraint errors name the field", () => {
  assert.match(profileError({ code: "23514", message: 'violates check constraint "profiles_phone_check"' }), /Phone can only contain/);
  assert.equal(profileError({ code: "23514", message: 'violates check constraint "profiles_full_name_check"' }), "One of the fields is too long.");
});
