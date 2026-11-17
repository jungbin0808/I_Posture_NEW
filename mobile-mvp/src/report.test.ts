import { it, expect } from "vitest";
import {
  reportRows,
  previousEntry,
  changeValue,
  formatValue,
} from "./report-data";
import type { Entry } from "./store";
const entry = (
  id: string,
  date: string,
  kind: Entry["kind"],
  data: any,
): Entry => ({ id, date, kind, data, media: [], title: id });
it("compares the nearest earlier record of the same precision movement", () => {
  const current = entry("current", "2026-11-17", "precision", { key: "a" });
  expect(
    previousEntry(current, [
      current,
      entry("later", "2026-11-18", "precision", { key: "a" }),
      entry("wrong", "2026-11-16", "precision", { key: "b" }),
      entry("older", "2026-11-13", "precision", { key: "a" }),
      entry("match", "2026-11-15", "precision", { key: "a" }),
    ])?.id,
  ).toBe("match");
});
it("never coerces missing measurements to zero or computes a false delta", () => {
  expect(
    reportRows(entry("x", "", "precision", { key: "a", angle: null }))[0].value,
  ).toBeNull();
  expect(changeValue(null, 90)).toBeNull();
  expect(changeValue(90, null)).toBeNull();
  expect(changeValue(80, 90)).toBe(-10);
  expect(formatValue(null, "°")).toBe("측정 불가");
  expect(formatValue(0, "°")).toBe("0°");
});
it("motion statistics use observed frames and preserve missing joints", () => {
  const rows = reportRows(
    entry("x", "", "motion", {
      frames: [
        { angles: { leftKnee: 80 } },
        { angles: { leftKnee: null } },
        { angles: { leftKnee: 110 } },
      ],
    }),
  );
  expect(rows.find((r) => r.key === "leftKneeRange")?.value).toBe(30);
  expect(rows.find((r) => r.key === "leftKneeMin")?.note).toContain("2/3");
  expect(rows.find((r) => r.key === "rightKneeMin")?.value).toBeNull();
});
it("inbody reports keep units and omit fields the user never entered", () => {
  expect(reportRows(entry("x", "", "inbody", { weight: 68.5 }))).toEqual([
    expect.objectContaining({ key: "weight", value: 68.5, unit: "kg" }),
  ]);
});
