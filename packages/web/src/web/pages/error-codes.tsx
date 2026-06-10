import { useState, useRef } from "react";
import BackButton from "../components/BackButton";

interface ErrorCode {
  id: number;
  error_code: string;
  software_id: string;
  description: string;
  possible_reason: string;
  solution: string;
}

export default function ErrorCodesPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ErrorCode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) { setResults(null); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/error-codes?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      setResults(data);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") search(query);
  };

  const clear = () => {
    setQuery("");
    setResults(null);
    setError("");
    setExpanded(null);
    inputRef.current?.focus();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#030d03", color: "#c8f0c8", fontFamily: "monospace" }}>
      {/* Header */}
      <div style={{ background: "#0a1f0a", borderBottom: "1px solid #1a4a1a", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
        <BackButton />
        <div>
          <div style={{ fontSize: "17px", fontWeight: "bold", color: "#4aff6a" }}>⚠️ Error Code Lookup</div>
          <div style={{ fontSize: "11px", color: "#4a8a4a" }}>TLS Maintenance Manual — Table 3-7</div>
        </div>
      </div>

      {/* Search Box */}
      <div style={{ padding: "24px 16px 16px" }}>
        <div style={{ background: "#0a1f0a", border: "1px solid #1a4a1a", borderRadius: "10px", padding: "16px" }}>
          <div style={{ fontSize: "12px", color: "#4a8a4a", marginBottom: "8px" }}>Enter error code or keyword</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="e.g. 101, AOA, TILT, DDM..."
              style={{
                flex: 1, background: "#030d03", border: "1px solid #2a6a2a",
                borderRadius: "6px", padding: "10px 12px", color: "#c8f0c8",
                fontFamily: "monospace", fontSize: "15px", outline: "none"
              }}
            />
            {query && (
              <button onClick={clear} style={{ background: "none", border: "1px solid #2a4a2a", borderRadius: "6px", color: "#4a8a4a", padding: "0 12px", cursor: "pointer", fontSize: "18px" }}>✕</button>
            )}
            <button
              onClick={() => search(query)}
              disabled={loading}
              style={{ background: "#0a3a0a", border: "1px solid #2a8a2a", borderRadius: "6px", color: "#4aff6a", padding: "10px 18px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" }}
            >
              {loading ? "⟳" : "SEARCH"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && <div style={{ marginTop: "12px", color: "#ff4a4a", fontSize: "13px", textAlign: "center" }}>{error}</div>}

        {/* No results */}
        {results !== null && results.length === 0 && !loading && (
          <div style={{ marginTop: "24px", textAlign: "center", color: "#4a6a4a", fontSize: "14px" }}>
            No error codes found for "{query}"
          </div>
        )}

        {/* Results */}
        {results && results.length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <div style={{ fontSize: "11px", color: "#4a6a4a", marginBottom: "10px" }}>{results.length} result{results.length !== 1 ? "s" : ""} found</div>
            {results.map(ec => (
              <div
                key={ec.id}
                onClick={() => setExpanded(expanded === ec.id ? null : ec.id)}
                style={{ background: "#0a1a0a", border: "1px solid #1a4a1a", borderRadius: "8px", marginBottom: "10px", overflow: "hidden", cursor: "pointer" }}
              >
                {/* Summary row */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px" }}>
                  <div style={{ background: "#0a3a0a", border: "1px solid #2a7a2a", borderRadius: "6px", padding: "4px 10px", fontSize: "15px", fontWeight: "bold", color: "#4aff6a", minWidth: "52px", textAlign: "center" }}>
                    {ec.error_code}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "12px", color: "#6ab86a", marginBottom: "2px" }}>{ec.software_id}</div>
                    <div style={{ fontSize: "13px", color: "#c8f0c8" }}>{ec.description}</div>
                  </div>
                  <div style={{ color: "#2a6a2a", fontSize: "16px" }}>{expanded === ec.id ? "▲" : "▼"}</div>
                </div>

                {/* Expanded detail */}
                {expanded === ec.id && (
                  <div style={{ borderTop: "1px solid #1a3a1a", padding: "14px" }}>
                    <Section label="Possible Reason" color="#ffa040" text={ec.possible_reason} />
                    <Section label="Corrective Action" color="#40c0ff" text={ec.solution} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Hint when empty */}
        {results === null && !loading && (
          <div style={{ marginTop: "32px", textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔍</div>
            <div style={{ color: "#4a6a4a", fontSize: "13px" }}>Search by error number (e.g. 101)<br/>or keyword (e.g. AOA, TILT, DDM)</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ label, color, text }: { label: string; color: string; text: string }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ fontSize: "10px", fontWeight: "bold", color, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "13px", color: "#a0d0a0", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>{text}</div>
    </div>
  );
}
