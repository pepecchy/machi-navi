// ./x check (data part). Each failure prints file, problem and fix. Rules are defined in CLAUDE.md.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { LANGS, ROOT, missingInText, readSnapshot, readYaml, snapshotPath, sourcedRecords, walk } from "./lib.ts";

const fails: string[] = [];
const fail = (check: string, file: string, msg: string, fix: string) => fails.push(`FAIL [${check}] ${file}: ${msg}\n  fix: ${fix}`);
const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isUrl = (v: unknown) => typeof v === "string" && /^https:\/\//.test(v);
const isStr = (v: unknown) => typeof v === "string" && v.length > 0;

// ---- type
const facts = new Map<string, any>();
for (const f of walk("data/national")) {
  const d = readYaml(f);
  const ok = isStr(d?.id) && Array.isArray(d.values) && d.values.every((n: unknown) => typeof n === "number") && isStr(d.unit)
    && isStr(d.doc) && isUrl(d.source) && Array.isArray(d.quotes) && d.quotes.length > 0 && isDate(d.checked);
  if (!ok) fail("type", f, "fact needs id, values[], unit, doc, source(https), quotes[], checked(YYYY-MM-DD)", "see 'データの形' in CLAUDE.md");
  else facts.set(d.id, d);
}
const cities = walk("data/cities").map((f) => f.split("/")[2]).filter((v, i, a) => a.indexOf(v) === i);
for (const c of cities) {
  const base = `data/cities/${c}`;
  for (const need of ["city.yaml", "move-in.yaml", "hoikuryo.yaml"])
    if (!existsSync(join(ROOT, base, need))) fail("type", base, `missing ${need}`, "a city needs city.yaml, move-in.yaml and hoikuryo.yaml");
  if (fails.length) continue;
  const city = readYaml(`${base}/city.yaml`);
  if (city.id !== c || LANGS.some((l) => !isStr(city.name?.[l]))) fail("type", `${base}/city.yaml`, "id must equal the folder name and name needs every language", `add name.{${LANGS.join(",")}}`);
  const mv = readYaml(`${base}/move-in.yaml`);
  if (!(isStr(mv.window) && Array.isArray(mv.bring) && Array.isArray(mv.bring_foreign) && Array.isArray(mv.other) && isStr(mv.doc) && isUrl(mv.source)
    && Array.isArray(mv.quotes) && mv.quotes.length > 0 && isDate(mv.checked) && (mv.hours === null || (isStr(mv.hours?.open) && isStr(mv.hours?.close)))))
    fail("type", `${base}/move-in.yaml`, "needs window, hours(null or open/close), bring[], bring_foreign[], other[], doc, source, quotes[], checked", "see data/cities/nakatsu/move-in.yaml");
  const fee = readYaml(`${base}/hoikuryo.yaml`);
  const tierOk = (t: any) => isStr(t?.label) && (t.max === null || Number.isInteger(t.max)) && Number.isInteger(t.std) && Number.isInteger(t.short);
  if (!(["free", "half", "half_any", "half100"].includes(fee.second_child) && Array.isArray(fee.tiers) && fee.tiers.length > 1 && fee.tiers.every(tierOk)
    && fee.tiers.at(-1).max === null && isStr(fee.kinto?.label) && isStr(fee.hikazei) && isStr(fee.seiho) && isStr(fee.doc) && isUrl(fee.source) && isDate(fee.checked) && Number.isInteger(fee.fiscal_year)))
    fail("type", `${base}/hoikuryo.yaml`, "fee table has a wrong shape", "see data/cities/nakatsu/hoikuryo.yaml");
  if (existsSync(join(ROOT, base, "office-hours.yaml"))) {
    const oh = readYaml(`${base}/office-hours.yaml`);
    if (!(isStr(oh.hours?.open) && isStr(oh.hours?.close) && isStr(oh.doc) && isUrl(oh.source) && Array.isArray(oh.quotes) && oh.quotes.length > 0 && isDate(oh.checked)))
      fail("type", `${base}/office-hours.yaml`, "needs hours(open/close), doc, source, quotes[], checked", "see data/cities/hikone/office-hours.yaml");
  }
  if (fee.tax_adjust !== undefined && !(Number.isInteger(fee.tax_adjust?.num) && Number.isInteger(fee.tax_adjust?.den) && fee.tax_adjust.den > 0))
    fail("type", `${base}/hoikuryo.yaml`, "tax_adjust needs integer num and den", "write the ratio the source states, e.g. num: 6, den: 8");
}
const scenes = walk("scenes").map((f) => ({ f, d: readYaml(f) }));
for (const { f, d } of scenes)
  for (const s of d.steps ?? []) {
    if (!isStr(s.id)) fail("type", f, "step without id", "give each step an id");
    if (s.fact && !facts.has(s.fact)) fail("type", f, `step ${s.id} refers to unknown fact ${s.fact}`, "add the fact under data/national/ or fix the id");
    if (s.when && !["child", "foreign"].includes(s.when)) fail("type", f, `step ${s.id} has unknown condition ${s.when}`, "use child or foreign");
  }

// ---- source and fee table: everything cited must be in the saved copy of the source
for (const rec of sourcedRecords()) {
  const snap = readSnapshot(rec.source);
  if (snap === null) { fail("source", rec.file, `no saved copy of ${rec.source}`, `run ./x fetch ${rec.source} and commit ${snapshotPath(rec.source)}`); continue; }
  for (const m of missingInText(rec, snap))
    fail(rec.numbers.length ? "fee-table" : "source", rec.file, m, `copy the text exactly as it appears in ${snapshotPath(rec.source)}, or drop the item`);
}

// ---- wording
// Numbers of two or more digits (deadlines, amounts). Counts like "2nd" are often words, so one digit is ignored.
const digits = (s: string) => (s.normalize("NFKC").replace(/[०-९]/g, (c) => String(c.charCodeAt(0) - 0x966)).match(/\d{2,}/g) ?? []).sort().join(",");
const dict = Object.fromEntries(LANGS.map((l) => [l, readYaml(`i18n/${l}.yaml`) as Record<string, string>]));
for (const l of LANGS) {
  for (const k of Object.keys(dict.ja)) {
    if (!isStr(dict[l][k])) { fail("wording", `i18n/${l}.yaml`, `missing key ${k}`, `add ${k} (it exists in i18n/ja.yaml)`); continue; }
    if (digits(dict[l][k]) !== digits(dict.ja[k])) fail("wording", `i18n/${l}.yaml`, `numbers in ${k} differ from ja ("${digits(dict.ja[k])}" vs "${digits(dict[l][k])}")`, "use the same numbers (2 digits or more), written as digits, in every language");
    if (dict[l][k].length > 240) fail("wording", `i18n/${l}.yaml`, `${k} is longer than 240 characters`, "this site has no articles; shorten it");
  }
  for (const k of Object.keys(dict[l])) if (!(k in dict.ja)) fail("wording", `i18n/${l}.yaml`, `key ${k} is not in ja`, "add it to i18n/ja.yaml or remove it");
}
for (const { f, d } of scenes)
  for (const s of d.steps ?? []) {
    for (const k of [`s_${s.id}`, ...(s.fact ? [`s_${s.id}_due`] : [])]) if (!isStr(dict.ja[k])) fail("wording", f, `step ${s.id} needs wording key ${k}`, `add ${k} to every i18n file`);
    const due = dict.ja[`s_${s.id}_due`];
    if (s.fact && due) for (const v of facts.get(s.fact)?.values ?? []) if (!digits(due).split(",").includes(String(v))) fail("wording", "i18n/ja.yaml", `s_${s.id}_due does not contain the value ${v} of fact ${s.fact}`, "write the deadline with the fact's value");
  }

// A record may name the wording it backs; those keys must exist.
for (const f of [...walk("data/national"), ...walk("data/cities")]) for (const k of readYaml(f)?.wording ?? [])
  if (!isStr(dict.ja[k])) fail("wording", f, `wording key ${k} does not exist`, "name a key from i18n/ja.yaml, or remove it from the record");

// ---- scope: site/ holds templates only
for (const f of walk("site")) if (!/\.(astro|ts|css)$/.test(f)) fail("scope", f, "site/ may hold only .astro, .ts and .css templates", "move facts to data/ and wording to i18n/");

// ---- kind, size, protected: compare with main
const git = (...a: string[]) => { try { return execFileSync("git", a, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return null; } };
const branch = process.env.BRANCH || git("rev-parse", "--abbrev-ref", "HEAD") || "";
const base = git("merge-base", "origin/main", "HEAD");
if (base && branch !== "main") {
  const kind = branch.startsWith("claude/maintain-") ? "maintain" : branch.startsWith("claude/build-") ? "build" : null;
  if (!kind) fail("kind", branch, "branch name must start with claude/maintain- or claude/build-", "rename the branch");
  const status = (git("diff", "--name-status", base, "HEAD") ?? "").split("\n").filter(Boolean).map((l) => l.split("\t"));
  if (kind === "maintain")
    for (const [st, file] of status) {
      if (/^(site|gate|\.github)\//.test(file)) fail("kind", file, "a maintain branch may not change site/, gate/ or .github/", "do this in a build session");
      if (st === "A" && /^(data\/cities|scenes|calc|i18n)\//.test(file)) fail("kind", file, "a maintain branch may not add cities, scenes, calculators or languages", "do this in a build session");
    }
  const hadGate = git("cat-file", "-e", `${base}:gate/check.ts`) !== null;
  if (hadGate) {
    const lines = (git("diff", "--numstat", base, "HEAD") ?? "").split("\n").filter(Boolean).map((l) => l.split("\t"))
      .filter(([, , f]) => !/^(data\/|state\/sources\/|package-lock\.json$)/.test(f)).reduce((n, [a, d]) => n + (+a || 0) + (+d || 0), 0);
    if (lines > 800) fail("size", branch, `diff is ${lines} lines (limit 800, excluding data/, state/sources/, package-lock.json)`, "split the change into smaller PRs");
  }
  if (status.some(([, f]) => f === "CLAUDE.md") && process.env.PR_LABELS !== undefined && !process.env.PR_LABELS.split(",").includes("approved-by-owner"))
    fail("protected", "CLAUDE.md", "changing CLAUDE.md needs the approved-by-owner label", "ask the owner; do not change CLAUDE.md without their instruction");
}

if (fails.length) { console.log(fails.join("\n")); process.exit(1); }
