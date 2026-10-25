"use client";
import { useState, useRef } from "react";

const MIN_CHARS = 50;
const MAX_CHARS = 8000;

export default function Home() {
  const [text, setText] = useState("");
  const [style, setStyle] = useState("bullets");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const abortRef = useRef(null);

  async function summarise() {
    setError(""); setSummary(""); setCopied(false);
    const t = text.trim();
    if (!t) return setError("Please paste some text to summarise.");
    if (t.length < MIN_CHARS) return setError(`Text is too short. Enter at least ${MIN_CHARS} characters.`);
    if (t.length > MAX_CHARS) return setError(`Text is too long. The limit is ${MAX_CHARS} characters.`);

    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, style }),
        signal: controller.signal,
      });
      if (!res.ok) {
        let msg = "Something went wrong. Please try again.";
        try { msg = (await res.json()).error || msg; } catch {}
        throw new Error(msg);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setSummary((s) => s + decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      if (e.name === "AbortError") setError("Stopped.");
      else if (e instanceof TypeError) setError("Could not reach the server. Check your connection.");
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(summary); setCopied(true); } catch {}
  }

  return (
    <main className="wrap">
      <h1>Text Summariser</h1>
      <p className="sub">Paste an article, email or notes and get a clear summary.</p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your text here..."
        rows={10}
        disabled={loading}
      />
      <div className="meta">
        <span className={text.length > MAX_CHARS ? "bad" : ""}>{text.length} / {MAX_CHARS}</span>
      </div>

      <div className="row">
        <select value={style} onChange={(e) => setStyle(e.target.value)} disabled={loading}>
          <option value="bullets">Bullet points</option>
          <option value="short">Short (2-3 sentences)</option>
          <option value="detailed">Detailed (~150 words)</option>
        </select>
        <button onClick={summarise} disabled={loading}>
          {loading ? "Summarising..." : "Summarise"}
        </button>
        {loading && <button className="ghost" onClick={() => abortRef.current?.abort()}>Stop</button>}
      </div>

      {error && <div className="error" role="alert">{error}</div>}
      {loading && !summary && <div className="note">Reading your text...</div>}

      {summary && (
        <section className="result">
          <div className="resulthead">
            <strong>Summary</strong>
            {!loading && <button className="ghost" onClick={copy}>{copied ? "Copied" : "Copy"}</button>}
          </div>
          <div className="out">{summary}</div>
        </section>
      )}
    </main>
  );
}