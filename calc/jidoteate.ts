// Monthly child allowance from the national table. Pure; used by the site and by tests.
// Amounts come from data/national/child-allowance-amount.yaml (values: under 3, 3 to high-school age, third child or later).
export interface Amounts { under3: number; upto18: number; third: number }
// older: children past high-school age, up to the March 31 after turning 22, whom the parent supports.
// They are counted as older siblings for the third-child rule but get no allowance themselves.
export interface Kids { under3: number; upto18: number; older: number }

export const amounts = (values: number[]): Amounts => ({ under3: values[0], upto18: values[1], third: values[2] });

// Children are counted from the oldest, so the older group comes first, then high-school age and below, then under 3.
export function allowance(a: Amounts, k: Kids): number {
  let total = 0;
  let rank = k.older;
  for (const [n, base] of [[k.upto18, a.upto18], [k.under3, a.under3]] as const)
    for (let i = 0; i < n; i++) total += ++rank >= 3 ? a.third : base;
  return total;
}
