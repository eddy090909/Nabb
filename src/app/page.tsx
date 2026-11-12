"use client";

import { FormEvent, useEffect, useState } from "react";
import { DEFAULT_TERM, TERMS } from "@/lib/terms";
import { NEW_WESMAPS_URL, OLD_WESMAPS_URL } from "@/lib/links";

type SearchResult = { sectionLabel: string; courseTitle: string; crse: string; term: string };
type Watch = {
  id: string;
  sectionLabel: string;
  courseTitle: string;
  crse: string;
  term: string;
  active: boolean;
  lastSeats: number | null;
  notifiedAt?: string | null;
};

type Me = {
  email: string;
  phone: string | null;
  notifyEmail: boolean;
  notifySms: boolean;
};

type RegWindow = { start: string; end: string };

const watchKey = (w: { crse: string; term: string; sectionLabel: string }) =>
  `${w.term}-${w.crse}-${w.sectionLabel}`;

/** "2026-11-18" -> "Nov 18" (date-only, no time-zone shifting). */
function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatRange(w: RegWindow): string {
  return w.start === w.end ? formatDay(w.start) : `${formatDay(w.start)} – ${formatDay(w.end)}`;
}

/** Today's date in Eastern Time as YYYY-MM-DD, matching src/lib/registration.ts. */
function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function termLabel(code: string): string {
  return TERMS.find((t) => t.code === code)?.label ?? code;
}

export default function Home() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [authStatus, setAuthStatus] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [term, setTerm] = useState(DEFAULT_TERM);
  const [subject, setSubject] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState("");
  const [watches, setWatches] = useState<Watch[]>([]);

  const [windowActive, setWindowActive] = useState<boolean | null>(null);
  const [windows, setWindows] = useState<RegWindow[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [notifySms, setNotifySms] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState("");

  useEffect(() => {
    refreshRegistrationStatus();
    refreshWatches();
  }, []);

  async function refreshRegistrationStatus() {
    try {
      const res = await fetch("/api/registration-status");
      if (res.ok) {
        const data = await res.json();
        setWindowActive(Boolean(data.active));
        setWindows(Array.isArray(data.windows) ? data.windows : []);
      }
    } catch {
      // non-fatal
    }
  }

  async function refreshMe() {
    const res = await fetch("/api/me");
    if (res.ok) {
      const data = await res.json();
      setMe(data);
      setPhoneInput(data.phone || "");
      setNotifySms(Boolean(data.notifySms));
    }
  }

  async function refreshWatches() {
    const res = await fetch("/api/watches");
    if (res.ok) {
      const data = await res.json();
      setWatches(data.watches);
      setSignedIn(true);
      refreshMe();
    }
  }

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthStatus("Sending code…");
    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCodeSent(true);
        setAuthStatus(`We sent a 6-digit code to ${email}.`);
      } else {
        setAuthStatus(data.error || "Something went wrong.");
      }
    } catch {
      setAuthStatus("Could not reach the server. Is npm run dev still running?");
    } finally {
      setAuthBusy(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthStatus("Verifying…");
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      if (res.ok) {
        setSignedIn(true);
        setAuthStatus("");
        refreshWatches();
      } else {
        const data = await res.json().catch(() => ({}));
        setAuthStatus(data.error || "Invalid code.");
      }
    } catch {
      setAuthStatus("Could not reach the server. Is npm run dev still running?");
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSignedIn(false);
    setWatches([]);
    setResults(null);
    setSearchStatus("");
    setMe(null);
    setCodeSent(false);
    setCode("");
    setAuthStatus("Signed out.");
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim()) return;
    setSearching(true);
    setSearchStatus("Searching WesMaps…");
    try {
      const res = await fetch(
        `/api/search?subject=${encodeURIComponent(subject.trim())}&term=${encodeURIComponent(term)}`
      );
      const data = await res.json();
      if (res.ok) {
        const filtered = (data.results as SearchResult[]).filter((r) => r.term === term);
        setResults(filtered);
        setSearchStatus(
          filtered.length
            ? `${filtered.length} section${filtered.length === 1 ? "" : "s"} in ${termLabel(term)}.`
            : ""
        );
      } else {
        setResults(null);
        setSearchStatus(data.error || "Search failed.");
      }
    } catch {
      setResults(null);
      setSearchStatus("Could not reach the server.");
    } finally {
      setSearching(false);
    }
  }

  async function addWatch(r: SearchResult) {
    const res = await fetch("/api/watches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(r),
    });
    if (res.ok) {
      setSearchStatus(`Watching ${r.sectionLabel}.`);
      refreshWatches();
    } else {
      const data = await res.json().catch(() => ({}));
      setSearchStatus(data.error || "Failed to add watch.");
    }
  }

  async function removeWatch(id: string) {
    await fetch(`/api/watches/${id}`, { method: "DELETE" });
    refreshWatches();
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    setSettingsStatus("Saving…");
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phoneInput, notifySms }),
    });
    const data = await res.json();
    if (res.ok) {
      setMe(data);
      setPhoneInput(data.phone || "");
      setNotifySms(Boolean(data.notifySms));
      setSettingsStatus("Notification settings saved.");
    } else {
      setSettingsStatus(data.error || "Failed to save settings.");
    }
  }

  function watchStatus(w: Watch): { label: string; tone: "ok" | "warn" | "idle" } {
    if (!w.active) return { label: "Alert sent", tone: "ok" };
    if (w.lastSeats === null || windowActive === false) return { label: "Not yet open", tone: "idle" };
    if (w.lastSeats > 0)
      return { label: `${w.lastSeats} seat${w.lastSeats === 1 ? "" : "s"}`, tone: "ok" };
    return { label: "Full", tone: "warn" };
  }

  const today = todayET();
  const nextWindow = windows
    .filter((w) => w.end >= today)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  const watchedKeys = new Set(watches.filter((w) => w.active).map(watchKey));

  return (
    <main className="page">
      <header className="header">
        <div>
          <h1 className="brand">
            Nabb<span>.</span>
          </h1>
          <p className="tagline">
            The easiest way in to a course you&apos;re trying to get into. Get an instant
            notification the moment a seat opens.
          </p>
        </div>
        {signedIn && (
          <button className="btn btn-ghost btn-sm" onClick={signOut}>
            Sign out
          </button>
        )}
      </header>

      {windowActive === true && (
        <div className="banner live" role="status">
          <span className="dot" aria-hidden />
          <div>
            <strong>Seat alerts are live</strong>
            We&apos;re checking WesMaps regularly during this registration period.
          </div>
        </div>
      )}
      {windowActive === false && (
        <div className="banner waiting" role="status">
          <span className="dot" aria-hidden />
          <div>
            <strong>
              {nextWindow ? `Next alert window: ${formatRange(nextWindow)}` : "Seat alerts are paused"}
            </strong>
            Alerts run during add/drop and adjustment periods. Add watches now and
            we&apos;ll notify you as soon as seats open.
          </div>
        </div>
      )}

      <section className="card" aria-labelledby="where-heading">
        <h2 id="where-heading">Where to look</h2>
        <p className="hint">
          Wesleyan has two versions of WesMaps right now. Faculty recommend the old one
          because the new one and Stellic are missing some courses.
        </p>
        <ul className="sources">
          <li>
            <strong>
              <a href={OLD_WESMAPS_URL} target="_blank" rel="noreferrer">
                Old WesMaps ↗
              </a>
            </strong>
            Browse every course. Nabb reads seats from here.
          </li>
          <li>
            <strong>Stellic</strong>
            Where you actually preregister and register.
          </li>
          <li>
            <strong>
              <a href={NEW_WESMAPS_URL} target="_blank" rel="noreferrer">
                New WesMaps ↗
              </a>
            </strong>
            Still missing courses and recent edits.
          </li>
        </ul>
      </section>

      {!signedIn && (
        <section className="card" aria-labelledby="signin-heading">
          <h2 id="signin-heading">Sign in</h2>
          <p className="hint">No password. We email a one-time code to your Wesleyan address.</p>
          {!codeSent ? (
            <form className="row" onSubmit={requestCode}>
              <label className="field grow">
                Wesleyan email
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@wesleyan.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={authBusy}>
                Send code
              </button>
            </form>
          ) : (
            <>
              <form className="row" onSubmit={verifyCode}>
                <label className="field grow">
                  6-digit code
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                </label>
                <button className="btn btn-primary" type="submit" disabled={authBusy}>
                  Verify
                </button>
              </form>
              <p className="status">
                <button
                  className="link-btn"
                  onClick={() => {
                    setCodeSent(false);
                    setCode("");
                    setAuthStatus("");
                  }}
                >
                  Use a different email
                </button>
              </p>
            </>
          )}
          <p className="status" aria-live="polite">
            {authStatus}
          </p>
        </section>
      )}

      {signedIn && (
        <>
          <section className="card" aria-labelledby="find-heading">
            <h2 id="find-heading">Find a section</h2>
            <p className="hint">Search by subject code, then watch the sections you want.</p>
            <form className="row" onSubmit={search}>
              <label className="field">
                Term
                <select value={term} onChange={(e) => setTerm(e.target.value)}>
                  {TERMS.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field grow">
                Subject
                <input
                  type="text"
                  placeholder="e.g. COMP, ECON, MATH"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value.toUpperCase())}
                  autoCapitalize="characters"
                  required
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={searching}>
                {searching ? "Searching…" : "Search"}
              </button>
            </form>
            <p className="status" aria-live="polite">
              {searchStatus}
            </p>

            {results && results.length === 0 && (
              <p className="empty">
                No sections found for {subject} in {termLabel(term)}. Check the subject code on{" "}
                <a href={OLD_WESMAPS_URL} target="_blank" rel="noreferrer">
                  old WesMaps
                </a>
                .
              </p>
            )}
            {results && results.length > 0 && (
              <ul className="list">
                {results.map((r) => {
                  const watching = watchedKeys.has(watchKey(r));
                  return (
                    <li key={watchKey(r)}>
                      <span className="title">
                        <span className="code">{r.sectionLabel}</span>
                        <span className="name">{r.courseTitle}</span>
                      </span>
                      <span className="actions">
                        <button
                          className={`btn btn-sm ${watching ? "btn-ghost" : "btn-primary"}`}
                          onClick={() => addWatch(r)}
                          disabled={watching}
                        >
                          {watching ? "Watching" : "Watch"}
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card" aria-labelledby="watches-heading">
            <h2 id="watches-heading">Your watches</h2>
            {watches.length === 0 ? (
              <p className="empty">No watches yet. Search for a section above to start.</p>
            ) : (
              <ul className="list">
                {watches.map((w) => {
                  const s = watchStatus(w);
                  return (
                    <li key={w.id}>
                      <span className="title">
                        <span className="code">{w.sectionLabel}</span>
                        <span className="name">
                          {w.courseTitle} · {termLabel(w.term)}
                        </span>
                      </span>
                      <span className="actions">
                        <span className={`pill ${s.tone}`}>{s.label}</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => removeWatch(w.id)}>
                          Remove
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card" aria-labelledby="settings-heading">
            <h2 id="settings-heading">Notifications</h2>
            <p className="hint">
              {me ? `Email alerts go to ${me.email}. ` : ""}Add a phone number to also get a text.
            </p>
            <form onSubmit={saveSettings}>
              <label className="field">
                Phone (US)
                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder="(860) 555-1234"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={notifySms}
                  onChange={(e) => setNotifySms(e.target.checked)}
                />
                Text me when a seat opens
              </label>
              <button className="btn btn-primary" type="submit">
                Save
              </button>
            </form>
            <p className="status" aria-live="polite">
              {settingsStatus}
            </p>
          </section>
        </>
      )}

      <footer className="footer">
        A student-built tool, not affiliated with Wesleyan University. Seat data comes
        from public WesMaps pages.
      </footer>
    </main>
  );
}
