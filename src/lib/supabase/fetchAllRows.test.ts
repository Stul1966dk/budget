import { describe, expect, it } from "vitest";
import type { PostgrestError } from "@supabase/supabase-js";
import { fetchAllRows, SUPABASE_PAGE_SIZE } from "./fetchAllRows";

function fakeTable(size: number) {
  const rows = Array.from({ length: size }, (_, i) => i);
  const calls: [number, number][] = [];
  const build = (from: number, to: number) => {
    calls.push([from, to]);
    return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
  };
  return { build, calls };
}

describe("fetchAllRows", () => {
  it("henter alle rækker over flere bidder", async () => {
    const { build, calls } = fakeTable(2500);
    const { data, error } = await fetchAllRows(build);

    expect(error).toBeNull();
    expect(data).toHaveLength(2500);
    expect(data.at(-1)).toBe(2499);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("stopper efter en ekstra tom bid, når antallet går op i sidestørrelsen", async () => {
    const { build, calls } = fakeTable(SUPABASE_PAGE_SIZE);
    const { data } = await fetchAllRows(build);
    expect(data).toHaveLength(SUPABASE_PAGE_SIZE);
    expect(calls).toHaveLength(2);
  });

  it("returnerer fejlen og det der nåede at blive hentet", async () => {
    let call = 0;
    const { data, error } = await fetchAllRows((from, to) => {
      call += 1;
      return Promise.resolve(
        call === 1
          ? { data: Array.from({ length: to - from + 1 }, () => 1), error: null }
          : {
              data: null,
              error: { message: "boom", code: "500" } as PostgrestError,
            },
      );
    });
    expect(data).toHaveLength(SUPABASE_PAGE_SIZE);
    expect(error?.message).toBe("boom");
  });
});
