// ./x check (display part). Runs after the build: internal links, phone width, and one calculation in a real browser.
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { chromium } from "playwright";
import { ROOT, walk } from "./lib.ts";

const BASE = "/machi-navi";
const fails: string[] = [];
const dist = join(ROOT, "dist");
const toFile = (p: string) => join(dist, p.replace(/[?#].*$/, ""), p.replace(/[?#].*$/, "").endsWith("/") ? "index.html" : "");

for (const f of walk("dist").filter((x) => x.endsWith(".html"))) {
  const html = readFileSync(join(ROOT, f), "utf8");
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const u = m[1];
    if (!u.startsWith("/")) continue;
    if (!u.startsWith(BASE + "/")) { fails.push(`FAIL [display] ${f}: link ${u} is outside the base path\n  fix: build links from import.meta.env.BASE_URL`); continue; }
    if (!existsSync(toFile(u.slice(BASE.length)))) fails.push(`FAIL [display] ${f}: broken link ${u}\n  fix: point it at a page that exists`);
  }
}

const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const server = createServer((req, res) => {
  const p = toFile((req.url ?? "/").slice(BASE.length) || "/");
  if (!req.url?.startsWith(BASE) || !existsSync(p)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": types[extname(p)] ?? "application/octet-stream" }).end(readFileSync(p));
}).listen(0);
const port = (server.address() as { port: number }).port;

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of ["/", "/ja/nakatsu/", "/en/hikone/", "/ne/kitamoto/"]) {
    await page.goto(`http://localhost:${port}${BASE}${path}`, { waitUntil: "load" });
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth))
      fails.push(`FAIL [display] ${path}: the page overflows sideways at 375px\n  fix: let the wide element wrap or scroll inside its own box`);
  }
  await page.goto(`http://localhost:${port}${BASE}/ja/nakatsu/`, { waitUntil: "load" });
  const fee = (await page.textContent("#fee"))?.replace(/[^\d]/g, "");
  if (fee !== "32000") fails.push(`FAIL [display] /ja/nakatsu/: default calculation shows "${fee}", expected 32000\n  fix: the page script must use calc/hoikuryo.ts with this city's table`);
  await page.click("label:has(#hasChild)");
  if (await page.isVisible("#fee")) fails.push("FAIL [display] /ja/nakatsu/: the calculator stays visible without a child\n  fix: hide every [data-when=child] element when the box is unchecked");
  for (const e of errors) fails.push(`FAIL [display] script error: ${e}\n  fix: see site/pages`);
} finally {
  await browser.close();
  server.close();
}
if (fails.length) { console.log(fails.join("\n")); process.exit(1); }
