"use client";

import { useEffect, useState } from "react";

type SearchResult = { sectionLabel: string; courseTitle: string; crse: string; term: string };
type Watch = {
  id: string;
  sectionLabel: string;
  courseTitle: string;
  crse: string;
  term: string;
  active: boolean;
  lastSeats: number | null;
};

const CURRENT_TERM = "1269"; // Fall 2026 - update each semester, or build a term picker

export default function Home() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const [subject, setSubject] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    refreshWatches();
  }, []);

  async function refreshWatches() {
    const res = await fetch("/api/watches");
    if (res.ok) {
      const data = await res.json();
      setWatches(data.watches);
      setSignedIn(true);
    }
  }

  async function requestCode() {
    setStatus("Sending code...");
    const res = await fetch("/api/auth/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (res.ok) {
      setCodeSent(true);
      setStatus("Check your Wesleyan email for a 6-digit code.");
    } else {
      setStatus(data.error || "Something went wrong.");
    }
  }

  async function verifyCode() {
    setStatus("Verifying...");
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
      const data = await res.json();
      setStatus(data.error || "Invalid code.");
    }
  }

  async function search() {
    setStatus("Searching WesMaps...");
    const res = await fetch(`/api/search?subject=${encodeURIComponent(subject)}&term=${CURRENT_TERM}`);
    const data = await res.json();
    if (res.ok) {
      setResults(data.results);
      setStatus(`Found ${data.results.length} section(s).`);
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

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ marginBottom: 4 }}>WesSeats</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Get an email/text the moment a seat opens in a Wesleyan course.
      </p>

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
                  key={r.sectionLabel}
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

          <section style={{ background: "white", padding: 20, borderRadius: 10 }}>
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
                    <em style={{ color: "#888" }}>
                      ({w.lastSeats === null ? "checking..." : `${w.lastSeats} seats`})
                    </em>
                  </span>
                  <button onClick={() => removeWatch(w.id)}>Remove</button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {status && <p style={{ color: "#666", marginTop: 16 }}>{status}</p>}
    </main>
  );
}
