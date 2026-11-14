// Daycare fee lookup from a city's official fee table. Pure; used by the site and by tests.
export interface Tier { label: string; max: number | null; std: number; short: number }
export interface FeeTable {
  // The basic fee is waived for every child (no tiers are published).
  free_all?: boolean;
  // half10 / half100: half, rounded down to 10 / 100 yen.
  second_child: "free" | "half" | "half10" | "half100";
  // Shown next to the rule so readers see the city's own sentence.
  quotes?: string[];
  second_child_quote?: number;
  // Some cities levy a different rate than the one the fee table assumes; the tax is rescaled first.
  tax_adjust?: { num: number; den: number };
  tiers: Tier[];
  kinto: { label: string; std: number; short: number };
  hikazei: string;
  seiho: string;
}
export type Status = "tax" | "kinto" | "hikazei" | "seiho";
export type Hours = "std" | "short";

export function calc(t: FeeTable, status: Status, tax: number, child: 1 | 2, hours: Hours) {
  if (t.free_all) return { tier: "-", fee: 0, base: 0 };
  let tier: string, base: number;
  if (status === "seiho") { tier = t.seiho; base = 0; }
  else if (status === "hikazei") { tier = t.hikazei; base = 0; }
  else if (status === "kinto") { tier = t.kinto.label; base = t.kinto[hours]; }
  else {
    // A tier applies while the income-based tax is below its upper bound; the last tier has no bound.
    const adjusted = t.tax_adjust ? Math.floor((tax * t.tax_adjust.num) / t.tax_adjust.den) : tax;
    const row = t.tiers.find((x) => x.max === null || adjusted < x.max)!;
    tier = row.label; base = row[hours];
  }
  let fee = base;
  if (child === 2) {
    if (t.second_child === "free") fee = 0;
    else if (t.second_child === "half") fee = base / 2;
    else if (t.second_child === "half10") fee = Math.floor(base / 2 / 10) * 10;
    else fee = Math.floor(base / 2 / 100) * 100;
  }
  return { tier, fee, base };
}
