// Daycare fee lookup from a city's official fee table. Pure; used by the site and by tests.
// std2 / short2: the second-child amount, for tables that print one per tier.
export interface Tier { label: string; max: number | null; std: number; short: number; std2?: number; short2?: number }
export interface FeeTable {
  // The basic fee is waived for every child (no tiers are published).
  free_all?: boolean;
  // half10 / half100: half, rounded down to 10 / 100 yen. table: the printed second-child column.
  second_child: "free" | "half" | "half10" | "half100" | "table";
  // Shown next to the rule so readers see the city's own sentence.
  quotes?: string[];
  second_child_quote?: number;
  // Some cities levy a different rate than the one the fee table assumes; the tax is rescaled first.
  tax_adjust?: { num: number; den: number };
  tiers: Tier[];
  kinto: { label: string; std: number; short: number; std2?: number; short2?: number };
  hikazei: string;
  seiho: string;
}
export type Status = "tax" | "kinto" | "hikazei" | "seiho";
export type Hours = "std" | "short";

export function calc(t: FeeTable, status: Status, tax: number, child: 1 | 2, hours: Hours) {
  if (t.free_all) return { tier: "-", fee: 0, base: 0 };
  let tier: string, base: number, second = 0;
  if (status === "seiho") { tier = t.seiho; base = 0; }
  else if (status === "hikazei") { tier = t.hikazei; base = 0; }
  else if (status === "kinto") { tier = t.kinto.label; base = t.kinto[hours]; second = (hours === "std" ? t.kinto.std2 : t.kinto.short2) ?? 0; }
  else {
    // A tier applies while the income-based tax is below its upper bound; the last tier has no bound.
    const adjusted = t.tax_adjust ? Math.floor((tax * t.tax_adjust.num) / t.tax_adjust.den) : tax;
    const row = t.tiers.find((x) => x.max === null || adjusted < x.max)!;
    tier = row.label; base = row[hours]; second = (hours === "std" ? row.std2 : row.short2) ?? 0;
  }
  let fee = base;
  if (child === 2) {
    if (t.second_child === "free") fee = 0;
    else if (t.second_child === "half") fee = base / 2;
    else if (t.second_child === "table") fee = second;
    else if (t.second_child === "half10") fee = Math.floor(base / 2 / 10) * 10;
    else fee = Math.floor(base / 2 / 100) * 100;
  }
  return { tier, fee, base };
}
