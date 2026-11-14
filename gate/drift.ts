// ./x drift: fetch every source again and report records whose quotes or amounts are no longer there.
// Prints a Markdown report and exits 1 when something drifted. Uses no AI.
import { fetchText, missingInText, sourcedRecords } from "./lib.ts";

const bySource = new Map<string, ReturnType<typeof sourcedRecords>>();
for (const r of sourcedRecords()) bySource.set(r.source, [...(bySource.get(r.source) ?? []), r]);

const report: string[] = [];
for (const [url, recs] of bySource) {
  let text: string;
  try { text = await fetchText(url); }
  catch (e) { report.push(`- ${url}\n  - could not be fetched: ${(e as Error).message}\n  - records: ${recs.map((r) => r.file).join(", ")}`); continue; }
  for (const r of recs) {
    const miss = missingInText(r, text);
    if (miss.length) report.push(`- ${url}\n  - record: ${r.file}\n${miss.map((m) => `  - ${m}`).join("\n")}`);
  }
}
if (report.length) { console.log(`Sources that no longer match their records:\n\n${report.join("\n")}`); process.exit(1); }
console.log("ok");
