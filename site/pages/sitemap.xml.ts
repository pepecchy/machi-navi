// Lists every page for search engines. Built from the same city list as the pages.
import type { APIRoute } from "astro";
import { LANGS, cities } from "../load.ts";

export const GET: APIRoute = ({ site }) => {
  const root = new URL(import.meta.env.BASE_URL, site).href;
  const urls = [root, ...LANGS.flatMap((l) => cities.map((c) => `${root}${l}/${c.id}/`))];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml" } });
};
