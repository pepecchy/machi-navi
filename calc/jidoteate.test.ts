import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { expect, test } from "vitest";
import { allowance, amounts } from "./jidoteate.ts";

const fact = parse(readFileSync(join(import.meta.dirname, "../data/national/child-allowance-amount.yaml"), "utf8"));
const a = amounts(fact.values);
const yen = (n: number) => `${n.toLocaleString("en-US")}円`;

test("amounts are the ones quoted from the source", () => {
  expect(fact.quotes[0]).toContain(`3歳未満 ${yen(a.under3)}(第3子以降は${yen(a.third)})`);
  expect(fact.quotes[1]).toContain(`高校生年代まで ${yen(a.upto18)}(第3子以降は${yen(a.third)})`);
});

test.each([
  [{ under3: 0, upto18: 0, older: 0 }, 0],
  [{ under3: 1, upto18: 0, older: 0 }, 15000],
  [{ under3: 0, upto18: 1, older: 0 }, 10000],
  [{ under3: 1, upto18: 1, older: 0 }, 25000],
  [{ under3: 0, upto18: 2, older: 0 }, 20000],
  // The third child from the oldest gets the third-child amount.
  [{ under3: 1, upto18: 2, older: 0 }, 50000],
  [{ under3: 0, upto18: 3, older: 0 }, 50000],
  [{ under3: 2, upto18: 2, older: 0 }, 80000],
  // Older siblings get nothing but are counted.
  [{ under3: 0, upto18: 0, older: 2 }, 0],
  [{ under3: 0, upto18: 1, older: 1 }, 10000],
  [{ under3: 1, upto18: 0, older: 1 }, 15000],
  [{ under3: 1, upto18: 1, older: 1 }, 40000],
  [{ under3: 1, upto18: 0, older: 2 }, 30000],
])("%o -> %i yen a month", (k, want) => {
  expect(allowance(a, k)).toBe(want);
});
