import { NeckStrategy } from "./vendor/modules/analysis/strategies/neck.strategy";
import { ShouldersStrategy } from "./vendor/modules/analysis/strategies/shoulders.strategy";
import { ElbowsStrategy } from "./vendor/modules/analysis/strategies/elbows.strategy";
import { TorsoStrategy } from "./vendor/modules/analysis/strategies/torso.strategy";
import { PelvisStrategy } from "./vendor/modules/analysis/strategies/pelvis.strategy";
import { KneesStrategy } from "./vendor/modules/analysis/strategies/knees.strategy";
import { AnkleStrategy } from "./vendor/modules/analysis/strategies/ankle.strategy";
import { mapPrecisionInput } from "./precision-map";
export type Point = { x: number; y: number; z?: number; visibility: number };
export type Pose = Record<string, Point>;
export type Shot = { points: Pose; image: Blob; width: number; height: number };
export type Motion = {
  key: string;
  group: string;
  label: string;
  view: string;
  resultKey: string;
  required: string[];
};
const groups = [
  [
    "목",
    "Neck",
    [
      ["LateralFlexion", "가쪽 굽힘", "sideBend", "정면"],
      ["Flexion", "앞으로 굽힘", "bendingForward", "왼쪽 측면"],
      ["Extension", "뒤로 폄", "bendingBackward", "왼쪽 측면"],
      ["Rotation", "회전", "rotation", "정면"],
    ],
  ],
  [
    "어깨",
    "Shoulder",
    [
      ["Abduction", "벌림", "jointMoving", "정면"],
      ["Adduction", "모음", "jointAdduction", "정면"],
      ["Flexion", "앞으로 굽힘", "jointBending", "측면"],
      ["Extension", "뒤로 폄", "jointStraightening", "측면"],
      ["InternalRotation", "안쪽 회전", "jointTurningIn", "정면"],
      ["ExternalRotation", "바깥쪽 회전", "jointTurningOut", "정면"],
    ],
  ],
  [
    "팔꿈치",
    "Elbow",
    [
      ["Flexion", "굽힘", "jointBending", "측면"],
      ["Extension", "폄", "jointStraightening", "측면"],
    ],
  ],
  [
    "몸통",
    "Trunk",
    [
      ["LateralFlexion", "가쪽 굽힘", "sideBending", "정면"],
      ["Rotation", "회전", "rotation", "정면"],
      ["Flexion", "앞으로 굽힘", "bending", "오른쪽 측면"],
      ["Extension", "뒤로 폄", "straightening", "오른쪽 측면"],
    ],
  ],
  [
    "고관절",
    "Hip",
    [
      ["Abduction", "벌림", "jointMoving", "정면"],
      ["Adduction", "모음", "jointMovingInward", "정면"],
      ["Flexion", "굽힘", "jointBending", "측면"],
      ["Extension", "폄", "jointStraightening", "측면"],
      ["InternalRotation", "안쪽 회전", "jointTurningInward", "정면"],
      ["ExternalRotation", "바깥쪽 회전", "jointTurningOutward", "정면"],
    ],
  ],
  [
    "무릎",
    "Knee",
    [
      ["Flexion", "굽힘", "bending", "측면"],
      ["Extension", "폄", "extending", "측면"],
    ],
  ],
  [
    "발목",
    "Ankle",
    [
      ["Dorsiflexion", "발등 굽힘", "bending", "측면"],
      ["Plantarflexion", "발바닥 굽힘", "extention", "측면"],
      ["Inversion", "안쪽 기울임", "inwardCollapse", "정면"],
      ["Eversion", "바깥쪽 기울임", "outwardCollapse", "정면"],
    ],
  ],
] as [string, string, string[][]][];
export const motions: Motion[] = groups.flatMap(([group, prefix, actions]) =>
  actions.flatMap(([action, label, result, view]) => {
    const sides =
      ["Neck", "Trunk"].includes(prefix) &&
      ["Flexion", "Extension"].includes(action)
        ? [""]
        : ["Left", "Right"];
    return sides.map((side) => ({
      key: prefix + side + action,
      group,
      label:
        (side === "Left" ? "왼쪽 " : side === "Right" ? "오른쪽 " : "") + label,
      view:
        view === "측면"
          ? side === "Left"
            ? "왼쪽 측면"
            : "오른쪽 측면"
          : view,
      resultKey: result + side,
      required: [],
    }));
  }),
);
for (const motion of motions) {
  const k = motion.key,
    s = k.includes("Left") ? "Left" : "Right";
  motion.required =
    motion.group === "목"
      ? ["NeckFlexion", "NeckExtension"].includes(k)
        ? ["LeftEar", "LeftEyeOuter"]
        : ["Nose", "LeftShoulder", "RightShoulder"]
      : motion.group === "몸통"
        ? ["TrunkFlexion", "TrunkExtension"].includes(k)
          ? ["RightHip", "RightShoulder"]
          : ["LeftHip", "RightHip", "LeftShoulder", "RightShoulder"]
        : (motion.group === "어깨"
            ? k.includes("Rotation")
              ? ["Elbow", "Wrist"]
              : ["Shoulder", "Elbow"]
            : motion.group === "팔꿈치"
              ? ["Shoulder", "Elbow", "Wrist"]
              : motion.group === "고관절"
                ? k.includes("Rotation")
                  ? ["Knee", "Ankle"]
                  : ["Hip", "Knee"]
                : motion.group === "무릎"
                  ? ["Hip", "Knee", "Ankle"]
                  : k.includes("flexion")
                    ? ["Knee", "Ankle", "FootIndex"]
                    : ["Ankle", "FootIndex"]
          ).map((name) => s + name);
}
export const bodyCore = [
  "LeftShoulder",
  "RightShoulder",
  "LeftHip",
  "RightHip",
  "LeftKnee",
  "RightKnee",
  "LeftAnkle",
  "RightAnkle",
];
export function bodyRequired(step: number) {
  return step === 1
    ? ["RightEar", "RightShoulder", "RightHip", "RightKnee", "RightAnkle"]
    : [...bodyCore, ...(step === 0 ? ["Nose", "LeftEar", "RightEar"] : [])];
}
export function missing(
  p: Pose | null,
  required: string[],
  heightRatio = Infinity,
) {
  return required.filter(
    (k) =>
      !p?.[k] ||
      !Number.isFinite(p[k].x) ||
      !Number.isFinite(p[k].y) ||
      p[k].visibility < 0.5 ||
      p[k].x < 0 ||
      p[k].x > 1000 ||
      p[k].y < 0 ||
      p[k].y > heightRatio * 1000,
  );
}
export function assertPose(p: Pose, required: string[]) {
  if (missing(p, required).length)
    throw new Error("필요한 관절이 선명하게 보이도록 다시 촬영해 주세요.");
}
export async function precision(key: string, start: Pose, end: Pose) {
  const motion = motions.find((m) => m.key === key);
  if (!motion) throw new Error("지원하지 않는 동작입니다.");
  assertPose(start, motion.required);
  assertPose(end, motion.required);
  const strategies: Record<
    string,
    () => { execute: (p: any) => Promise<any> }
  > = {
    목: () => new NeckStrategy(),
    어깨: () => new ShouldersStrategy(),
    팔꿈치: () => new ElbowsStrategy(),
    몸통: () => new TorsoStrategy(),
    고관절: () => new PelvisStrategy(),
    무릎: () => new KneesStrategy(),
    발목: () => new AnkleStrategy(),
  };
  const input: any = {};
  mapPrecisionInput(key, start, end, input);
  const result = await strategies[motion.group]().execute(input);
  const angle = Number.parseFloat(
    String(result.scoreDetail[motion.resultKey]?.result),
  );
  if (!Number.isFinite(angle))
    throw new Error(
      "관절 각도를 계산하지 못했습니다. 촬영 방향을 확인해 주세요.",
    );
  return {
    angle: Math.round(angle * 10) / 10,
    key,
    label: motion.group + " " + motion.label,
    referenceStatus: "unavailable",
    algorithm: "original-iposture",
  };
}
export function joint(a?: Point, b?: Point, c?: Point): number | null {
  if (!a || !b || !c || [a, b, c].some((p) => p.visibility < 0.5)) return null;
  const u = [a.x - b.x, a.y - b.y],
    v = [c.x - b.x, c.y - b.y],
    d = Math.hypot(...u) * Math.hypot(...v);
  return d < 1e-8
    ? null
    : Math.round(
        ((Math.acos(
          Math.min(1, Math.max(-1, (u[0] * v[0] + u[1] * v[1]) / d)),
        ) *
          180) /
          Math.PI) *
          10,
      ) / 10;
}
export function angles(p: Pose) {
  return {
    leftKnee: joint(p.LeftHip, p.LeftKnee, p.LeftAnkle),
    rightKnee: joint(p.RightHip, p.RightKnee, p.RightAnkle),
    leftElbow: joint(p.LeftShoulder, p.LeftElbow, p.LeftWrist),
    rightElbow: joint(p.RightShoulder, p.RightElbow, p.RightWrist),
  };
}
