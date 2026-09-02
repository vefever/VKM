import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A small, dependency-free Markdown renderer for advisor replies.
 *
 * The model answers in the same shapes ChatGPT / Claude do — headings, ordered
 * and bulleted steps, small tables, the occasional snippet — so the chat has to
 * render those properly or a good answer reads as a wall of asterisks. We parse
 * only what the advisor actually emits (no raw HTML, no images), which keeps it
 * safe: every leaf is React text, never dangerouslySetInnerHTML.
 */

// ---------------------------------------------------------------------------
// Inline: **bold**, *italic*, `code`, [links](url), ~~strike~~
// ---------------------------------------------------------------------------
const INLINE_RE =
  /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|`[^`\n]+`|~~[^~]+~~|\[[^\]]+\]\([^)\s]+\))/g;

function inlineMd(text: string, keyPrefix = ""): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  for (const part of text.split(INLINE_RE)) {
    if (!part) continue;
    const key = `${keyPrefix}i${i++}`;
    if (
      (part.startsWith("**") && part.endsWith("**")) ||
      (part.startsWith("__") && part.endsWith("__"))
    ) {
      out.push(
        <strong key={key} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>,
      );
    } else if (part.startsWith("~~") && part.endsWith("~~")) {
      out.push(
        <s key={key} className="opacity-70">
          {part.slice(2, -2)}
        </s>,
      );
    } else if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      out.push(
        <code
          key={key}
          className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {part.slice(1, -1)}
        </code>,
      );
    } else if (part.startsWith("*") && part.endsWith("*") && part.length > 1) {
      out.push(
        <em key={key} className="italic">
          {part.slice(1, -1)}
        </em>,
      );
    } else if (part.startsWith("[")) {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
      if (m) {
        const href = m[2];
        const safe = /^(https?:|mailto:|tel:|\/)/i.test(href) ? href : "#";
        out.push(
          <a
            key={key}
            href={safe}
            target={safe.startsWith("/") ? undefined : "_blank"}
            rel="noreferrer noopener"
            className="font-medium text-navy underline decoration-gold/60 underline-offset-2 hover:decoration-gold"
          >
            {m[1]}
          </a>,
        );
      } else {
        out.push(<span key={key}>{part}</span>);
      }
    } else {
      out.push(<span key={key}>{part}</span>);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Code block with its own copy button (the ChatGPT header strip)
// ---------------------------------------------------------------------------
function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-[oklch(0.22_0.05_265)]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-white/50">
          {lang || "code"}
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(code).then(() => {
              setCopied(true);
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-3 text-[13px] leading-relaxed text-white/90">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Block parser
// ---------------------------------------------------------------------------
const BULLET_RE = /^\s*[-*•]\s+/;
const ORDERED_RE = /^\s*(\d{1,2})[.)]\s+/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const TABLE_SEP_RE = /^\s*\|?[\s:-]*-[-\s|:]*\|?\s*$/;

const splitRow = (line: string) =>
  line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());

export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line — block separator.
    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced code (an unterminated fence mid-stream still renders).
    const fence = /^\s*```(\w*)\s*$/.exec(line);
    if (fence) {
      const lang = fence[1];
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++; // closing fence
      nodes.push(<CodeBlock key={key++} lang={lang} code={body.join("\n")} />);
      continue;
    }

    // Horizontal rule.
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      nodes.push(<hr key={key++} className="my-4 border-border" />);
      i++;
      continue;
    }

    // Heading.
    const h = HEADING_RE.exec(line);
    if (h) {
      const level = h[1].length;
      nodes.push(
        <p
          key={key++}
          className={cn(
            "font-semibold text-foreground first:mt-0",
            level <= 2 ? "mb-2 mt-5 text-base font-bold tracking-tight" : "mb-1.5 mt-4 text-[15px]",
          )}
        >
          {inlineMd(h[2], `h${key}`)}
        </p>,
      );
      i++;
      continue;
    }

    // Table: header row followed by a separator row.
    if (line.includes("|") && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      nodes.push(
        <div key={key++} className="my-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-secondary/60">
              <tr>
                {head.map((c, ci) => (
                  <th
                    key={ci}
                    className="whitespace-nowrap px-3 py-2 text-left font-semibold text-foreground"
                  >
                    {inlineMd(c, `th${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-t border-border">
                  {r.map((c, ci) => (
                    <td key={ci} className="px-3 py-2 align-top text-foreground/90">
                      {inlineMd(c, `td${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Blockquote.
    if (/^\s*>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i]))
        body.push(lines[i++].replace(/^\s*>\s?/, ""));
      nodes.push(
        <blockquote
          key={key++}
          className="my-3 rounded-r-lg border-l-[3px] border-gold/70 bg-secondary/40 py-2 pl-3 pr-2 text-foreground/90"
        >
          {inlineMd(body.join(" "), `q${key}`)}
        </blockquote>,
      );
      continue;
    }

    // Lists (ordered / unordered) with lazy continuation lines.
    if (BULLET_RE.test(line) || ORDERED_RE.test(line)) {
      const ordered = ORDERED_RE.test(line);
      const re = ordered ? ORDERED_RE : BULLET_RE;
      const start = ordered ? Number(ORDERED_RE.exec(line)![1]) : undefined;
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        if (re.test(l)) {
          items.push(l.replace(re, ""));
          i++;
        } else if (
          l.trim() &&
          items.length &&
          !BULLET_RE.test(l) &&
          !ORDERED_RE.test(l) &&
          !HEADING_RE.test(l) &&
          !/^\s*```/.test(l)
        ) {
          items[items.length - 1] += ` ${l.trim()}`;
          i++;
        } else break;
      }
      nodes.push(
        ordered ? (
          <ol
            key={key++}
            start={start}
            className="my-2 list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-navy/70"
          >
            {items.map((it, j) => (
              <li key={j} className="pl-0.5">
                {inlineMd(it, `l${key}-${j}`)}
              </li>
            ))}
          </ol>
        ) : (
          <ul key={key++} className="my-2 list-disc space-y-1.5 pl-5 marker:text-gold">
            {items.map((it, j) => (
              <li key={j} className="pl-0.5">
                {inlineMd(it, `l${key}-${j}`)}
              </li>
            ))}
          </ul>
        ),
      );
      continue;
    }

    // Paragraph — consume until a blank line or the start of another block.
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      if (
        !l.trim() ||
        BULLET_RE.test(l) ||
        ORDERED_RE.test(l) ||
        HEADING_RE.test(l) ||
        /^\s*```/.test(l) ||
        /^\s*>\s?/.test(l)
      )
        break;
      para.push(l);
      i++;
    }
    nodes.push(
      <p key={key++} className="my-2 first:mt-0 last:mb-0">
        {para.map((l, j) => (
          <span key={j}>
            {j > 0 && <br />}
            {inlineMd(l, `p${key}-${j}`)}
          </span>
        ))}
      </p>,
    );
  }

  return <div className={cn("text-[15px] leading-7 text-foreground", className)}>{nodes}</div>;
}
