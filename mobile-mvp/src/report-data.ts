import type { Entry } from "./store";
export type ReportRow = {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  note?: string;
};
export const kindLabels = {
  body: "체형측정",
  precision: "정밀측정",
  motion: "모션 분석",
  inbody: "인바디",
};
export const jointLabels = {
  leftKnee: "왼쪽 무릎",
  rightKnee: "오른쪽 무릎",
  leftElbow: "왼쪽 팔꿈치",
  rightElbow: "오른쪽 팔꿈치",
};
const number = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
export function reportRows(e: Entry): ReportRow[] {
  if (e.kind === "body")
    return (e.data.metrics || []).map((m: any) => ({
      key: m.label,
      label: m.label,
      value: number(m.value),
      unit: "°",
      note: m.reason || "정면·우측면 사진에서 계산한 각도",
    }));
  if (e.kind === "precision")
    return [
      {
        key: e.data.key,
        label: e.data.label || e.title,
        value: number(e.data.angle),
        unit: "°",
        note: e.data.reason || "시작 자세와 움직인 자세로 계산한 동작 각도",
      },
    ];
  if (e.kind === "inbody")
    return [
      ["weight", "체중", "kg"],
      ["skeletalMuscleMass", "골격근량", "kg"],
      ["percentBodyFat", "체지방률", "%"],
      ["bodyFatMass", "체지방량", "kg"],
      ["bmi", "BMI", ""],
      ["visceralFatLevel", "내장지방 레벨", ""],
      ["basalMetabolicRate", "기초대사량", "kcal"],
      ["bodyWater", "체수분", "L"],
    ]
      .filter(([key]) => e.data[key] !== undefined)
      .map(([key, label, unit]) => ({
        key,
        label,
        unit,
        value: number(e.data[key]),
        note: "직접 입력한 결과지 수치",
      }));
  return Object.entries(jointLabels).flatMap(([key, label]) => {
    const frames = e.data.frames || [];
    const values = frames
      .map((f: any) => number(f.angles?.[key]))
      .filter((v: number | null): v is number => v !== null);
    const note = `관측 ${values.length}/${frames.length}프레임 · 1초 간격`;
    return [
      {
        key: key + "Min",
        label: label + " 최소",
        value: values.length ? Math.min(...values) : null,
        unit: "°",
        note,
      },
      {
        key: key + "Max",
        label: label + " 최대",
        value: values.length ? Math.max(...values) : null,
        unit: "°",
        note,
      },
      {
        key: key + "Range",
        label: label + " 변화 폭",
        value: values.length
          ? Math.round((Math.max(...values) - Math.min(...values)) * 10) / 10
          : null,
        unit: "°",
        note,
      },
    ];
  });
}
export function previousEntry(current: Entry, entries: Entry[]) {
  return entries
    .filter(
      (e) =>
        e.id !== current.id &&
        e.kind === current.kind &&
        e.date < current.date &&
        (e.kind !== "precision" || e.data.key === current.data.key),
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}
export function changeValue(
  current: number | null,
  previous: number | null | undefined,
) {
  return current !== null &&
    typeof previous === "number" &&
    Number.isFinite(previous)
    ? Math.round((current - previous) * 10) / 10
    : null;
}
export function formatValue(v: number | null | undefined, unit = "") {
  return typeof v === "number" && Number.isFinite(v)
    ? `${v}${unit}`
    : "측정 불가";
}
