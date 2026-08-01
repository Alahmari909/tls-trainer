import React from "react";

/**
 * Lightweight, dependency-free Markdown renderer for AI answers.
 *
 * The AI replies in Markdown (##, ###, ---, **bold**, tables, lists), but the
 * chat bubble used to dump it as raw text with `white-space: pre-wrap`, so the
 * trainee saw literal "###" and broken "| a | b |" tables. This renders it
 * properly, styled for the app's dark military theme, with per-block RTL/LTR
 * detection so mixed Arabic/English answers stay readable.
 */

const C = "#00AEEF";

const isRtl = (s: string) => {
  const ar = (s.match(/[؀-ۿ]/g) ?? []).length;
  const la = (s.match(/[A-Za-z]/g) ?? []).length;
  return ar > la;
};

/** Inline formatting: **bold**, *italic*, `code`, links. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Split on inline code first so ** inside code isn't touched
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyPrefix}-i${i++}`;
    if (tok.startsWith("`")) {
      nodes.push(
        <code key={k} style={{
          fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace",
          fontSize: "0.88em", background: "rgba(0,174,239,0.12)",
          border: `1px solid ${C}33`, borderRadius: 5,
          padding: "1px 5px", color: "#7fe3ff", direction: "ltr",
          display: "inline-block", unicodeBidi: "embed",
        }}>{tok.slice(1, -1)}</code>
      );
    } else if (tok.startsWith("**") || tok.startsWith("__")) {
      nodes.push(<strong key={k} style={{ color: "#ffffff", fontWeight: 700 }}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("[")) {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok);
      nodes.push(
        <a key={k} href={mm?.[2] ?? "#"} target="_blank" rel="noreferrer"
           style={{ color: C, textDecoration: "underline" }}>{mm?.[1] ?? tok}</a>
      );
    } else {
      nodes.push(<em key={k} style={{ color: "#cfe8f7" }}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { t: "h"; level: number; text: string }
  | { t: "p"; text: string }
  | { t: "hr" }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "code"; text: string }
  | { t: "quote"; text: string }
  | { t: "table"; head: string[]; rows: string[][] };

const splitRow = (line: string) =>
  line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());

const isDivider = (line: string) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes("-");

function parse(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];

  const flush = () => {
    if (para.length) {
      const text = para.join("\n").trim();
      if (text) blocks.push({ t: "p", text });
      para = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // fenced code
    if (/^```/.test(trimmed)) {
      flush();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
      blocks.push({ t: "code", text: buf.join("\n") });
      continue;
    }

    // table: a row followed by a divider row
    if (trimmed.includes("|") && i + 1 < lines.length && isDivider(lines[i + 1]) && trimmed.replace(/[^|]/g, "").length >= 1) {
      flush();
      const head = splitRow(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        if (isDivider(lines[i])) { i++; continue; }
        rows.push(splitRow(lines[i]));
        i++;
      }
      i--;
      blocks.push({ t: "table", head, rows });
      continue;
    }

    // horizontal rule
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line) || /^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flush(); blocks.push({ t: "hr" }); continue;
    }

    // heading
    const h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (h) { flush(); blocks.push({ t: "h", level: h[1].length, text: h[2].trim() }); continue; }

    // blockquote
    if (/^>\s?/.test(trimmed)) {
      flush();
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) { buf.push(lines[i].trim().replace(/^>\s?/, "")); i++; }
      i--;
      blocks.push({ t: "quote", text: buf.join("\n") });
      continue;
    }

    // unordered list
    if (/^[-*•]\s+/.test(trimmed)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, "")); i++;
      }
      i--;
      blocks.push({ t: "ul", items });
      continue;
    }

    // ordered list
    if (/^\d+[.)]\s+/.test(trimmed)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, "")); i++;
      }
      i--;
      blocks.push({ t: "ol", items });
      continue;
    }

    if (trimmed === "") { flush(); continue; }
    para.push(line);
  }
  flush();
  return blocks;
}

export default function MarkdownMessage({ content }: { content: string }) {
  const blocks = React.useMemo(() => parse(content ?? ""), [content]);

  return (
    <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-primary)" }}>
      {blocks.map((b, i) => {
        const key = `b${i}`;
        switch (b.t) {
          case "h": {
            const rtl = isRtl(b.text);
            const size = b.level <= 2 ? 15 : b.level === 3 ? 13.5 : 13;
            return (
              <div key={key} dir={rtl ? "rtl" : "ltr"} style={{
                fontSize: size, fontWeight: 800, color: "#ffffff",
                margin: i === 0 ? "0 0 8px" : "14px 0 8px",
                paddingInlineStart: 10, lineHeight: 1.45,
                borderInlineStart: `3px solid ${C}`,
                textAlign: rtl ? "right" : "left",
              }}>
                {renderInline(b.text, key)}
              </div>
            );
          }
          case "hr":
            return <div key={key} style={{ height: 1, background: `linear-gradient(90deg,${C}45,transparent)`, margin: "12px 0", border: 0 }} />;
          case "code":
            return (
              <pre key={key} dir="ltr" style={{
                background: "rgba(0,0,0,0.45)", border: `1px solid ${C}25`,
                borderRadius: 8, padding: "10px 12px", margin: "10px 0",
                overflowX: "auto", fontSize: 11.5, lineHeight: 1.5,
                fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace",
                color: "#9fe8ff", whiteSpace: "pre",
              }}>{b.text}</pre>
            );
          case "quote": {
            const rtl = isRtl(b.text);
            return (
              <div key={key} dir={rtl ? "rtl" : "ltr"} style={{
                borderInlineStart: `3px solid ${C}66`, background: "rgba(0,174,239,0.07)",
                padding: "8px 12px", margin: "10px 0", borderRadius: 6,
                color: "var(--text-secondary)", fontSize: 12.5,
                textAlign: rtl ? "right" : "left",
              }}>{renderInline(b.text, key)}</div>
            );
          }
          case "ul":
          case "ol": {
            const rtl = isRtl(b.items.join(" "));
            return (
              <div key={key} dir={rtl ? "rtl" : "ltr"} style={{ margin: "8px 0", display: "flex", flexDirection: "column", gap: 5 }}>
                {b.items.map((it, j) => (
                  <div key={j} style={{ display: "flex", gap: 8, alignItems: "flex-start", textAlign: rtl ? "right" : "left" }}>
                    <span style={{
                      flexShrink: 0, color: C, fontWeight: 700, fontSize: 12,
                      minWidth: b.t === "ol" ? 18 : 10, lineHeight: 1.7,
                      textAlign: rtl ? "left" : "right",
                    }}>{b.t === "ol" ? `${j + 1}.` : "•"}</span>
                    <span style={{ flex: 1 }}>{renderInline(it, `${key}-${j}`)}</span>
                  </div>
                ))}
              </div>
            );
          }
          case "table": {
            const rtl = isRtl([...b.head, ...b.rows.flat()].join(" "));
            return (
              <div key={key} style={{ margin: "10px 0", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <table dir={rtl ? "rtl" : "ltr"} style={{
                  borderCollapse: "collapse", width: "100%", minWidth: 260,
                  fontSize: 12, border: `1px solid ${C}30`, borderRadius: 8, overflow: "hidden",
                }}>
                  <thead>
                    <tr style={{ background: "rgba(0,174,239,0.16)" }}>
                      {b.head.map((h, j) => (
                        <th key={j} style={{
                          padding: "7px 10px", textAlign: rtl ? "right" : "left",
                          color: "#ffffff", fontWeight: 700, fontSize: 11.5,
                          borderBottom: `1px solid ${C}40`,
                          borderInlineEnd: j < b.head.length - 1 ? `1px solid ${C}22` : "none",
                          whiteSpace: "nowrap",
                        }}>{renderInline(h, `${key}-h${j}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, ri) => (
                      <tr key={ri} style={{ background: ri % 2 ? "rgba(255,255,255,0.03)" : "transparent" }}>
                        {r.map((cell, ci) => (
                          <td key={ci} style={{
                            padding: "7px 10px", textAlign: rtl ? "right" : "left",
                            color: "var(--text-primary)",
                            borderTop: `1px solid ${C}18`,
                            borderInlineEnd: ci < r.length - 1 ? `1px solid ${C}18` : "none",
                            verticalAlign: "top",
                          }}>{renderInline(cell, `${key}-r${ri}c${ci}`)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          default: {
            const text = b.text;
            const rtl = isRtl(text);
            // Highlight source citations: (المرجع: ..., صفحة X) / (Ref: ...)
            const citation = /^\(?\s*(?:المرجع|المصدر|Ref(?:erence)?)\s*[:：]/i.test(text.trim());
            if (citation) {
              return (
                <div key={key} dir={rtl ? "rtl" : "ltr"} style={{
                  marginTop: 10, padding: "6px 10px",
                  background: "rgba(0,174,239,0.08)",
                  border: `1px solid ${C}28`, borderRadius: 7,
                  fontSize: 11, color: "#8fd4ef", lineHeight: 1.55,
                  textAlign: rtl ? "right" : "left",
                  display: "flex", gap: 6, alignItems: "flex-start",
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                       stroke={C} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                       style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  <span style={{ flex: 1 }}>{renderInline(text.replace(/^\(|\)$/g, ""), key)}</span>
                </div>
              );
            }
            return (
              <div key={key} dir={rtl ? "rtl" : "ltr"} style={{
                margin: i === 0 ? "0" : "7px 0 0",
                textAlign: rtl ? "right" : "left",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>{renderInline(text, key)}</div>
            );
          }
        }
      })}
    </div>
  );
}
