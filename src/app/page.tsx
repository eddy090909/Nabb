"use client";

import { useEffect, useState } from "react";
import { DEFAULT_TERM, TERMS } from "@/lib/terms";

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

export default function Home() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const [term, setTerm] = useState(DEFAULT_TERM);
  const [subject, setSubject] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [status, setStatus] = useState("");

  const [windowActive, setWindowActive] = useState<boolean | null>(null);
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

  async function requestCode() {
    setStatus("Sending code...");
    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCodeSent(true);
        setStatus("Check your Wesleyan email for a 6-digit code.");
      } else {
        setStatus(data.error || "Something went wrong.");
      }
    } catch {
      setStatus("Could not reach the server. Is npm run dev still running?");
    }
  }

  async function verifyCode() {
    setStatus("Verifying...");
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      if (res.ok) {
        setSignedIn(true);
        setStatus("");
        refreshWatches();
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus(data.error || "Invalid code.");
      }
    } catch {
      setStatus("Could not reach the server. Is npm run dev still running?");
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSignedIn(false);
    setWatches([]);
    setResults([]);
    setMe(null);
    setCodeSent(false);
    setCode("");
    setStatus("Signed out.");
  }

  async function search() {
    setStatus("Searching WesMaps...");
    const res = await fetch(
      `/api/search?subject=${encodeURIComponent(subject)}&term=${encodeURIComponent(term)}`
    );
    const data = await res.json();
    if (res.ok) {
      const filtered = (data.results as SearchResult[]).filter((r) => r.term === term);
      setResults(filtered);
      setStatus(`Found ${filtered.length} section(s).`);
    } else {
      setStatus(data.error || "Search failed.");
    }
  }

  async function addWatch(r: SearchResult) {
    const res = await fetch("/api/watches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(r),
    });
    if (res.ok) {
      setStatus(`Watching ${r.sectionLabel}.`);
      refreshWatches();
    } else {
      const data = await res.json();
      setStatus(data.error || "Failed to add watch.");
    }
  }

  async function removeWatch(id: string) {
    await fetch(`/api/watches/${id}`, { method: "DELETE" });
    refreshWatches();
  }

  async function saveSettings() {
    setSettingsStatus("Saving...");
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

  function watchStatusLabel(w: Watch): string {
    if (!w.active) return "Alerted";
    if (w.lastSeats === null || windowActive === false) return "Not yet open";
    return `${w.lastSeats} seat${w.lastSeats === 1 ? "" : "s"}`;
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Nabb</h1>
          <p style={{ color: "#555", marginTop: 0, marginBottom: 4 }}>
            The easiest way in to a course you&apos;re trying to get into.
          </p>
          <p style={{ color: "#555", marginTop: 0 }}>
            Get an instant notification the moment a seat opens.
          </p>
        </div>
        {signedIn && (
          <button onClick={signOut} style={{ marginTop: 8 }}>
            Sign out
          </button>
        )}
      </div>

      {windowActive === false && (
        <p
          style={{
            background: "#f7f3e8",
            border: "1px solid #e6dcc0",
            borderRadius: 8,
            padding: "12px 14px",
            color: "#555",
            marginBottom: 24,
          }}
        >
          Seat alerts run during Wesleyan add/drop and adjustment periods (next: Fall
          add/drop, Sept 7–18). You can still add watches now — we&apos;ll notify you when
          seats open during those windows.
        </p>
      )}

      {!signedIn && (
        <section style={{ background: "white", padding: 20, borderRadius: 10, marginBottom: 24 }}>
          <h3>Sign in</h3>
          {!codeSent ? (
            <>
              <input
                placeholder="you@wesleyan.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ padding: 8, width: "70%", marginRight: 8 }}
              />
              <button onClick={requestCode}>Send code</button>
            </>
          ) : (
            <>
              <input
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={{ padding: 8, width: "40%", marginRight: 8 }}
              />
              <button onClick={verifyCode}>Verify</button>
            </>
          )}
        </section>
      )}

      {signedIn && (
        <>
          <section style={{ background: "white", padding: 20, borderRadius: 10, marginBottom: 24 }}>
            <h3>Find a course</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ marginRight: 8 }}>
                Term{" "}
                <select value={term} onChange={(e) => setTerm(e.target.value)} style={{ padding: 8 }}>
                  {TERMS.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <input
              placeholder="Subject code, e.g. COMP"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{ padding: 8, width: "60%", marginRight: 8 }}
            />
            <button onClick={search}>Search</button>

            <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
              {results.map((r) => (
                <li
                  key={`${r.term}-${r.sectionLabel}-${r.crse}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <span>
                    <strong>{r.sectionLabel}</strong> — {r.courseTitle}
                  </span>
                  <button onClick={() => addWatch(r)}>Watch</button>
                </li>
              ))}
            </ul>
          </section>

          <section style={{ background: "white", padding: 20, borderRadius: 10, marginBottom: 24 }}>
            <h3>Your watches</h3>
            {watches.length === 0 && <p style={{ color: "#888" }}>No watches yet.</p>}
            <ul style={{ listStyle: "none", padding: 0 }}>
              {watches.map((w) => (
                <li
                  key={w.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <span>
                    <strong>{w.sectionLabel}</strong> — {w.courseTitle}{" "}
                    <em style={{ color: "#888" }}>({watchStatusLabel(w)})</em>
                  </span>
                  <button onClick={() => removeWatch(w.id)}>Remove</button>
                </li>
              ))}
            </ul>
          </section>

          <section style={{ background: "white", padding: 20, borderRadius: 10 }}>
            <h3>Notification settings</h3>
            {me && (
              <p style={{ color: "#666", marginTop: 0 }}>
                Signed in as {me.email}. Email alerts stay on by default.
              </p>
            )}
            <div style={{ marginBottom: 12 }}>
              <label>
                Phone (SMS){" "}
                <input
                  placeholder="+18605551234"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  style={{ padding: 8, width: "60%", marginLeft: 8 }}
                />
              </label>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>
                <input
                  type="checkbox"
                  checked={notifySms}
                  onChange={(e) => setNotifySms(e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                Text me when a seat opens
              </label>
            </div>
            <button onClick={saveSettings}>Save settings</button>
            {settingsStatus && (
              <p style={{ color: "#666", marginTop: 12, marginBottom: 0 }}>{settingsStatus}</p>
            )}
          </section>
        </>
      )}

      {status && <p style={{ color: "#666", marginTop: 16 }}>{status}</p>}
    </main>
  );
}
