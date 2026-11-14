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
  describe(city, () => {
    test("tiers are ascending and end unbounded", () => {
      const max = t.tiers.map((x) => x.max);
      expect(max.at(-1)).toBeNull();
      for (let i = 1; i < max.length - 1; i++) expect(max[i]!).toBeGreaterThan(max[i - 1]!);
    });
    t.tiers.forEach((row, i) => {
      if (row.max === null) return;
      test(`boundary ${row.max}`, () => {
        expect(calc(t, "tax", row.max! - 1, 1, "std")).toMatchObject({ tier: row.label, fee: row.std });
        expect(calc(t, "tax", row.max!, 1, "short")).toMatchObject({ tier: t.tiers[i + 1].label, fee: t.tiers[i + 1].short });
      });
    });
    test("non-taxed statuses", () => {
      expect(calc(t, "seiho", 0, 1, "std").fee).toBe(0);
      expect(calc(t, "hikazei", 0, 1, "std").fee).toBe(0);
      expect(calc(t, "kinto", 0, 1, "short").fee).toBe(t.kinto.short);
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
});
