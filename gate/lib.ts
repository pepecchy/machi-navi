// Shared helpers for gate scripts. No rules live here; rules are in CLAUDE.md.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";

export const ROOT = join(import.meta.dirname, "..");
export const LANGS = ["ja", "en", "zh", "vi", "ne"] as const;

export function walk(dir: string): string[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((n) => {
    const rel = join(dir, n);
    return statSync(join(ROOT, rel)).isDirectory() ? walk(rel) : [rel];
  });
}
export const readYaml = (rel: string): any => parse(readFileSync(join(ROOT, rel), "utf8"));

// Text is compared after NFKC, with whitespace removed, so layout differences do not matter.
export const squash = (s: string) => s.normalize("NFKC").replace(/\s+/g, "");

export const snapshotPath = (url: string) =>
  join("state/sources", createHash("sha1").update(url).digest("hex").slice(0, 12) + ".txt");

export function readSnapshot(url: string): string | null {
  const p = join(ROOT, snapshotPath(url));
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
}

export async function fetchText(url: string): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; source-check)" }, signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      let text: string;
      if (buf.subarray(0, 4).toString() === "%PDF") {
        const f = join(mkdtempSync(join(tmpdir(), "src-")), "a.pdf");
        writeFileSync(f, buf);
        text = execFileSync("pdftotext", ["-layout", f, "-"], { encoding: "utf8", maxBuffer: 64 << 20 });
      } else {
        text = htmlToText(buf.toString("utf8"));
      }
      return text.normalize("NFKC").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw new Error(`fetch failed: ${url}: ${lastErr}`);
}

// Amounts appear in sources with or without thousands separators.
export const hasNumber = (text: string, n: number) => {
  const t = squash(text);
  return t.includes(n.toLocaleString("en-US")) || t.includes(String(n));
};

export interface Sourced { file: string; source: string; quotes: string[]; numbers: number[] }

// Every record that cites a source, with what must be found in that source.
export function sourcedRecords(): Sourced[] {
  const out: Sourced[] = [];
  for (const file of [...walk("data/national"), ...walk("data/cities")].filter((f) => f.endsWith(".yaml"))) {
    const d = readYaml(file);
    if (!d?.source) continue;
    const numbers: number[] = [];
    if (Array.isArray(d.tiers)) {
      for (const t of d.tiers) numbers.push(...[t.max, t.std, t.short, t.std2, t.short2].filter((v: unknown) => typeof v === "number"));
      if (d.kinto) numbers.push(...[d.kinto.std, d.kinto.short, d.kinto.std2, d.kinto.short2].filter((v: unknown) => typeof v === "number"));
    }
    out.push({ file, source: d.source, quotes: d.quotes ?? [], numbers });
  }
  return out;
}

export function missingInText(rec: Sourced, text: string): string[] {
  const t = squash(text);
  return [
    ...rec.quotes.filter((q) => !t.includes(squash(q))).map((q) => `quote not found: "${q}"`),
    ...rec.numbers.filter((n) => !hasNumber(text, n)).map((n) => `number not found: ${n}`),
  ];
}
