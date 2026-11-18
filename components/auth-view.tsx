"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "./icon";

type Props = {
  /** False when the database connection is not set up: the form stays visible but cannot be used. */
  ready: boolean;
  onBack: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (name: string, email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  onWelcome: (name: string) => void;
};

type Message = { text: string; kind: "err" | "ok" };

export function AuthView({ ready, onBack, onSignIn, onSignUp, onWelcome }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(
    ready ? null : { text: "The database connection is not available, so sign-in is switched off.", kind: "err" },
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    if (mode === "signup" && !cleanName) return setMessage({ text: "Enter your name.", kind: "err" });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) return setMessage({ text: "Enter a valid email address.", kind: "err" });
    if (password.length < 6) return setMessage({ text: "Password must be at least 6 characters.", kind: "err" });
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "signup") {
        const result = await onSignUp(cleanName, cleanEmail, password);
        setPassword("");
        setMode("signin");
        if (result.needsEmailConfirmation) {
          setMessage({ text: `Almost there. We sent a confirmation link to ${cleanEmail}. Open it, then sign in here.`, kind: "ok" });
        } else {
          onWelcome(cleanName);
        }
      } else {
        await onSignIn(cleanEmail, password);
        setPassword("");
      }
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Something went wrong.", kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: "signin" | "signup") {
    setMode(next);
    if (ready) setMessage(null);
  }

  return (
    <section className="view active" id="view-auth">
      <div className="page">
        <div className="page-head"><button className="back-btn" onClick={onBack}><Icon name="back" /> Back</button></div>
        <div className="page-title" id="authTitle">{mode === "signup" ? "Create account" : "Sign in"}<small>Book a spot, pay, and keep your parking history.</small></div>
        <div className="day-tabs" id="authTabs" role="tablist">
          <button className={`day-tab ${mode === "signin" ? "on" : ""}`} data-mode="signin" role="tab" aria-selected={mode === "signin"} onClick={() => switchMode("signin")}>Sign in</button>
          <button className={`day-tab ${mode === "signup" ? "on" : ""}`} data-mode="signup" role="tab" aria-selected={mode === "signup"} onClick={() => switchMode("signup")}>Create account</button>
        </div>
        <form className="card form" id="authForm" noValidate onSubmit={submit}>
          {mode === "signup" && <div className="field"><label htmlFor="authName">Full name</label><input id="authName" autoComplete="name" maxLength={80} placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} /></div>}
          <div className="field"><label htmlFor="authEmail">Email</label><input id="authEmail" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          <div className="field"><label htmlFor="authPass">Password</label><input id="authPass" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="At least 6 characters" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
          {message && <div className={`msg ${message.kind}`} id="authMsg" role="status">{message.text}</div>}
          <button className={`btn btn-primary ${busy ? "busy" : ""}`} id="authSubmit" type="submit" disabled={!ready}>{mode === "signup" ? "Create account" : "Sign in"}</button>
        </form>
        <div className="hint-box quiet">Accounts are handled by Supabase Auth. Your password goes straight to it and is never stored by this app, and other drivers cannot read your bookings.</div>
      </div>
    </section>
  );
}
