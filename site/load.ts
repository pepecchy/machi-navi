// Reads data/, scenes/ and i18n/ for the templates. Pages hold no facts of their own.
import { readdirSync, readFileSync } from "node:fs";
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
  moveIn: y(`data/cities/${id}/move-in.yaml`),
  fee: y(`data/cities/${id}/hoikuryo.yaml`),
}));
export const scene = (id: string) => y(`scenes/${id}.yaml`);
