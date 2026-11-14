// Reads data/, scenes/ and i18n/ for the templates. Pages hold no facts of their own.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const root = process.cwd();
const y = (p: string) => parse(readFileSync(join(root, p), "utf8"));

export const LANGS = ["ja", "en", "zh", "vi", "ne"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_NAMES: Record<Lang, string> = { ja: "日本語", en: "English", zh: "中文", vi: "Tiếng Việt", ne: "नेपाली" };
export const HTML_LANG: Record<Lang, string> = { ja: "ja", en: "en", zh: "zh-Hans", vi: "vi", ne: "ne" };

export const dict = (l: Lang): Record<string, string> => y(`i18n/${l}.yaml`);
export const facts: Record<string, any> = Object.fromEntries(
  readdirSync(join(root, "data/national")).map((f) => { const d = y(`data/national/${f}`); return [d.id, d]; }),
);
export const cities = readdirSync(join(root, "data/cities")).map((id) => ({
  id,
  name: y(`data/cities/${id}/city.yaml`).name as Record<Lang, string>,
  pref: y(`data/cities/${id}/city.yaml`).pref as number,
  moveIn: y(`data/cities/${id}/move-in.yaml`),
  fee: y(`data/cities/${id}/hoikuryo.yaml`),
  // City hall opening hours, used when the move-in page states no hours of its own.
  office: existsSync(join(root, `data/cities/${id}/office-hours.yaml`)) ? y(`data/cities/${id}/office-hours.yaml`) : null,
}));
export const scene = (id: string) => y(`scenes/${id}.yaml`);
// The prefecture part of a city name: "福岡県 北九州市" in ja and zh, "Kitakyushu, Fukuoka" in the others.
export const prefOf = (name: string, l: Lang) => (l === "ja" || l === "zh" ? name.split(" ")[0] : name.split(", ").at(-1)!);
