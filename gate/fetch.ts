// ./x fetch <url>: save a normalized copy of a source page to state/sources/.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, fetchText, snapshotPath } from "./lib.ts";

const urls = process.argv.slice(2);
if (!urls.length) { console.error("usage: ./x fetch <url>..."); process.exit(2); }
for (const url of urls) {
  const text = await fetchText(url);
  writeFileSync(join(ROOT, snapshotPath(url)), `# ${url}\n${text}\n`);
  console.log(`${snapshotPath(url)} ${text.length} chars`);
}
