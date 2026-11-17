import { resolveBodyDisplayMetrics } from "./vendor/modules/analysis/helpers/body-display-metrics.helper";
import { cleanPose, missing, type Pose } from "./engine";

export async function body(front: Pose, side: Pose, back: Pose) {
  front = cleanPose(front);
  side = cleanPose(side);
  back = cleanPose(back);
  const m = resolveBodyDisplayMetrics({ front, right_side: side, back });
  const fields: [string, number, Pose, string[]][] = [
    [
      "목 기울기",
      m.front.neckTilt.displayAngle,
      front,
      ["LeftEar", "RightEar", "Nose", "LeftShoulder", "RightShoulder"],
    ],
    [
      "어깨 높이 차",
      m.front.shoulderAsymmetry.displayAngle,
      front,
      ["LeftShoulder", "RightShoulder"],
    ],
    [
      "골반 높이 차",
      m.front.pelvisAsymmetry.displayAngle,
      front,
      ["LeftHip", "RightHip"],
    ],
    [
      "측면 목 편위",
      m.side.neck.angle,
      side,
      ["RightHip", "RightAnkle", "RightEar", "RightShoulder"],
    ],
    [
      "측면 골반 경사",
      m.side.pelvisTilt.angle,
      side,
      ["RightHip", "RightAnkle", "RightKnee", "RightShoulder"],
    ],
    [
      "오른쪽 무릎",
      m.side.knee.rightAngle,
      side,
      ["RightHip", "RightKnee", "RightAnkle"],
    ],
  ];
  return {
    metrics: fields.map(([label, value, points, required]) => {
      const missingJoints = missing(points, required);
      const distinct = required.every((key, i) =>
        required
          .slice(i + 1)
          .every(
            (other) =>
              !points[key] ||
              !points[other] ||
              Math.hypot(
                points[key].x - points[other].x,
                points[key].y - points[other].y,
              ) > 1e-6,
          ),
      );
      const valid = !missingJoints.length && Number.isFinite(value) && distinct;
      return {
        label,
        value: valid ? Math.round(value * 10) / 10 : null,
        unit: "°",
        missingJoints,
        reason: valid
          ? ""
          : missingJoints.length
            ? "필요 관절 미인식"
            : "관절 각도 계산 불가",
      };
    }),
    referenceStatus: "unverified",
    algorithm: "original-iposture",
  };
}
