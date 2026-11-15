import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, test } from "vitest";
import { calc, type FeeTable } from "./hoikuryo.ts";

const dir = join(import.meta.dirname, "../data/cities");
const load = (c: string): FeeTable => parse(readFileSync(join(dir, c, "hoikuryo.yaml"), "utf8"));

// Every listed city: each tier boundary must select the right row.
for (const city of readdirSync(dir)) {
  const t = load(city);
  if (t.free_all) continue;
  describe(city, () => {
    test("tiers are ascending and end unbounded", () => {
      const max = t.tiers.map((x) => x.max);
      expect(max.at(-1)).toBeNull();
      for (let i = 1; i < max.length - 1; i++) expect(max[i]!).toBeGreaterThan(max[i - 1]!);
    });
    t.tiers.forEach((row, i) => {
      if (row.max === null) return;
      test(`boundary ${row.max}`, () => {
        // Boundaries are stated on the fee table's own scale; undo the city's tax rescaling for the input.
        const input = (v: number) => (t.tax_adjust ? Math.ceil((v * t.tax_adjust.den) / t.tax_adjust.num) : v);
        expect(calc(t, "tax", input(row.max!) - 1, 1, "std")).toMatchObject({ tier: row.label, fee: row.std });
        expect(calc(t, "tax", input(row.max!), 1, "short")).toMatchObject({ tier: t.tiers[i + 1].label, fee: t.tiers[i + 1].short });
        if (t.second_child === "table") expect(calc(t, "tax", input(row.max!) - 1, 2, "short").fee).toBe(row.short2);
      });
    });
    test("non-taxed statuses", () => {
      expect(calc(t, "seiho", 0, 1, "std").fee).toBe(0);
      expect(calc(t, "hikazei", 0, 1, "std").fee).toBe(0);
      expect(calc(t, "kinto", 0, 1, "short").fee).toBe(t.kinto.short);
      if (t.second_child === "table") expect(calc(t, "kinto", 0, 2, "std").fee).toBe(t.kinto.std2);
    });
  });
}

// Fixed cases worked out by hand from the fiscal 2026 tables.
test("known results", () => {
  expect(calc(load("nakatsu"), "tax", 120000, 1, "std").fee).toBe(32000);
  expect(calc(load("hikone"), "tax", 120000, 1, "std").fee).toBe(40000);
  expect(calc(load("kitamoto"), "tax", 120000, 1, "std").fee).toBe(38000);
  expect(calc(load("nakatsu"), "tax", 120000, 2, "std").fee).toBe(0);
  expect(calc(load("hikone"), "tax", 120000, 2, "std").fee).toBe(20000);
  expect(calc(load("kitamoto"), "tax", 120000, 2, "std").fee).toBe(19000);
  expect(calc(load("kitamoto"), "tax", 19999, 2, "short").fee).toBe(4300);
  // Kumamoto: 120,000 on the notice is 90,000 at the 6% rate, tier 4-3.
  expect(calc(load("kumamoto"), "tax", 120000, 1, "std")).toMatchObject({ tier: "4-3", fee: 27500 });
  expect(calc(load("kumamoto"), "tax", 120000, 2, "std").fee).toBe(13750);
  expect(calc(load("saitama"), "tax", 120000, 1, "std")).toMatchObject({ tier: "第6", fee: 19500 });
  expect(calc(load("saitama"), "tax", 120000, 2, "std").fee).toBe(9750);
  expect(calc(load("saitama"), "kinto", 0, 1, "short").fee).toBe(7800);
  expect(calc(load("sakai"), "tax", 120000, 1, "std")).toMatchObject({ tier: "D2", fee: 25000 });
  expect(calc(load("sakai"), "tax", 120000, 2, "std").fee).toBe(0);
  expect(calc(load("kawaguchi"), "tax", 120000, 1, "std")).toMatchObject({ tier: "第7階層", fee: 33000 });
  expect(calc(load("kawaguchi"), "tax", 120000, 2, "short").fee).toBe(16200);
  expect(calc(load("kawaguchi"), "kinto", 0, 1, "short").fee).toBe(5800);
  expect(calc(load("kagoshima"), "tax", 120000, 1, "short")).toMatchObject({ tier: "D3", fee: 34800 });
  expect(calc(load("kagoshima"), "tax", 120000, 2, "std").fee).toBe(17700);
  expect(calc(load("kagoshima"), "tax", 200000, 2, "short").fee).toBe(22800);
  expect(calc(load("gifu"), "tax", 120000, 1, "std")).toMatchObject({ tier: "第5階層", fee: 32000 });
  expect(calc(load("gifu"), "tax", 120000, 2, "short").fee).toBe(15800);
  expect(calc(load("gifu"), "kinto", 0, 1, "std").fee).toBe(14900);
  expect(calc(load("nishinomiya"), "tax", 120000, 1, "std")).toMatchObject({ tier: "C4", fee: 35600 });
  expect(calc(load("nishinomiya"), "tax", 120000, 2, "short").fee).toBe(17500);
  expect(calc(load("nishinomiya"), "kinto", 0, 2, "std").fee).toBe(5200);
  expect(calc(load("kashiwa"), "tax", 120000, 1, "std")).toMatchObject({ tier: "5-2", fee: 36200 });
  expect(calc(load("kashiwa"), "tax", 120000, 2, "short").fee).toBe(17790);
  expect(calc(load("kashiwa"), "kinto", 0, 2, "short").fee).toBe(2890);
  expect(calc(load("kawagoe"), "tax", 120000, 1, "std")).toMatchObject({ tier: "D9", fee: 35200 });
  expect(calc(load("kawagoe"), "tax", 120000, 2, "short").fee).toBe(17300);
  expect(calc(load("kawagoe"), "kinto", 0, 1, "short").fee).toBe(5800);
  expect(calc(load("nagano"), "tax", 120000, 1, "std")).toMatchObject({ tier: "D4", fee: 31500 });
  expect(calc(load("nagano"), "tax", 120000, 2, "short").fee).toBe(0);
  expect(calc(load("nagano"), "tax", 58000, 1, "short").fee).toBe(14000);
  expect(calc(load("matsumoto"), "tax", 120000, 1, "std")).toMatchObject({ tier: "D4", fee: 41200 });
  expect(calc(load("matsumoto"), "tax", 120000, 1, "short").fee).toBe(37000);
  expect(calc(load("matsumoto"), "tax", 120000, 2, "std").fee).toBe(0);
  expect(calc(load("toyohashi"), "tax", 120000, 1, "std")).toMatchObject({ tier: "6", fee: 30300 });
  expect(calc(load("toyohashi"), "tax", 50000, 1, "short").fee).toBe(0);
  expect(calc(load("toyohashi"), "tax", 120000, 2, "std").fee).toBe(0);
  expect(calc(load("amagasaki"), "tax", 120000, 1, "std")).toMatchObject({ tier: "D4", fee: 34300 });
  expect(calc(load("amagasaki"), "tax", 120000, 2, "short").fee).toBe(16950);
  expect(calc(load("amagasaki"), "kinto", 0, 1, "std").fee).toBe(13200);
  expect(calc(load("yokosuka"), "tax", 120000, 1, "std")).toMatchObject({ tier: "D7-1", fee: 35400 });
  expect(calc(load("yokosuka"), "tax", 200000, 2, "short").fee).toBe(20300);
  expect(calc(load("yokosuka"), "tax", 100000, 1, "std").fee).toBe(0);
  // Kitakyushu: 120,000 on the notice is 90,000 at the 6% rate, tier D3.
  expect(calc(load("kitakyushu"), "tax", 120000, 1, "std")).toMatchObject({ tier: "D3", fee: 28400 });
  expect(calc(load("kitakyushu"), "tax", 120000, 2, "std").fee).toBe(0);
  // Hiroshima: 120,000 on the notice is 90,000 at the 6% rate, tier C8.
  expect(calc(load("hiroshima"), "tax", 120000, 1, "std")).toMatchObject({ tier: "C8", fee: 23850 });
  expect(calc(load("hiroshima"), "tax", 120000, 2, "std").fee).toBe(11925);
  // Okayama: 120,000 on the notice is 90,000 at the 6% rate, tier C7; the printed second-child amount is 12,000.
  expect(calc(load("okayama"), "tax", 120000, 1, "std")).toMatchObject({ tier: "C7", fee: 24000 });
  expect(calc(load("okayama"), "tax", 120000, 2, "std").fee).toBe(12000);
  expect(calc(load("okayama"), "tax", 60000, 2, "short").fee).toBe(5850);
  // Shizuoka: 120,000 on the notice is 90,000 at the 6% rate, tier D5; second and later children are free.
  expect(calc(load("shizuoka"), "tax", 120000, 1, "std")).toMatchObject({ tier: "D5", fee: 20500 });
  expect(calc(load("shizuoka"), "tax", 120000, 2, "std").fee).toBe(0);
  // Sapporo: 120,000 on the notice is 90,000 at the 6% rate, tier D2.
  expect(calc(load("sapporo"), "tax", 120000, 1, "std")).toMatchObject({ tier: "D2", fee: 22550 });
  expect(calc(load("sapporo"), "tax", 120000, 2, "short").fee).toBe(0);
  // Chiba: 120,000 on the notice is 90,000 at the 6% rate, tier D4; the printed second-child amount is 13,320.
  expect(calc(load("chiba"), "tax", 120000, 1, "std")).toMatchObject({ tier: "D4", fee: 26650 });
  expect(calc(load("chiba"), "tax", 120000, 2, "std").fee).toBe(13320);
  // Sagamihara: 120,000 x 6/8 = 90,000 falls in D8; the second child pays half.
  expect(calc(load("sagamihara"), "tax", 120000, 1, "std")).toMatchObject({ tier: "D8", fee: 23600 });
  expect(calc(load("sagamihara"), "tax", 120000, 2, "std").fee).toBe(11800);
  // Yokohama: 120,000 on the notice is 90,000 at the 6% rate, tier D6; the printed second-child amount is 7,100.
  expect(calc(load("yokohama"), "tax", 120000, 1, "std")).toMatchObject({ tier: "D6", fee: 20400 });
  expect(calc(load("yokohama"), "tax", 120000, 2, "std").fee).toBe(7100);
  // Shinjuku waives the basic fee for every child.
  expect(calc(load("shinjuku"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("edogawa"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("koto"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("ota"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("minato"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("bunkyo"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("meguro"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("setagaya"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("suginami"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("nerima"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("chuo"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("nakano"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("kita"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("itabashi"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("adachi"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("toshima"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("sumida"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("chiyoda"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("shinagawa"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("arakawa"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("osaka"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("mitaka"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("musashino"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("nishitokyo"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("tachikawa"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("koganei"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("kodaira"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("fuchu"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("chofu"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("kunitachi"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("inagi"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("higashikurume"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("hamura"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("higashiyamato"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("kiyose"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("tama"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("ome"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("akiruno"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("fussa"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("hachioji"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("kokubunji"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("akishima"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("komae"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("hinode"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("mizuho"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("hinohara"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("okutama"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("miyake"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("niijima"), "tax", 120000, 1, "std").fee).toBe(0);
  expect(calc(load("oshima-tokyo"), "tax", 120000, 1, "std").fee).toBe(0);
});

// Rounding of the second-child half, on a made-up table.
test("half10 rounds the half down to 10 yen", () => {
  const t: FeeTable = { second_child: "half10", tiers: [{ label: "x", max: null, std: 26650, short: 4110 }], kinto: { label: "k", std: 0, short: 0 }, hikazei: "b", seiho: "a" };
  expect(calc(t, "tax", 1, 2, "std").fee).toBe(13320);
  expect(calc(t, "tax", 1, 2, "short").fee).toBe(2050);
});

test("free_all is 0 whatever the input", () => {
  const t = { free_all: true } as FeeTable;
  expect(calc(t, "tax", 500000, 1, "std")).toMatchObject({ tier: "-", fee: 0 });
  expect(calc(t, "kinto", 0, 2, "short").fee).toBe(0);
});
