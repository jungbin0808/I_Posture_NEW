import { BodyStrategy } from "./vendor/modules/analysis/strategies/body.strategy";
import { resolveBodyDisplayMetrics } from "./vendor/modules/analysis/helpers/body-display-metrics.helper";
import { assertPose, bodyRequired, type Pose } from "./engine";
import { AnkleAnalysis } from "./vendor/modules/analysis/strategies/body/ankle.analysis";
import { BackAnalysis } from "./vendor/modules/analysis/strategies/body/back.analysis";
import { HipJointAnalysis } from "./vendor/modules/analysis/strategies/body/hip-joint.analysis";
import { KneeAnalysis } from "./vendor/modules/analysis/strategies/body/knee.analysis";
import { LowerLimbAlignmentAnalysis } from "./vendor/modules/analysis/strategies/body/lower-limb-alignment.analysis";
import { NeckAnalysis } from "./vendor/modules/analysis/strategies/body/neck.analysis";
import { PelvisAnalysis } from "./vendor/modules/analysis/strategies/body/pelvis.analysis";
import { ShoulderAnalysis } from "./vendor/modules/analysis/strategies/body/shoulder.analysis";
import { TorsoAnalysis } from "./vendor/modules/analysis/strategies/body/torso.analysis";
import { UpperArmAnalysis } from "./vendor/modules/analysis/strategies/body/upper-arm.analysis";
import { BalanceIndexAnalysis } from "./vendor/modules/analysis/strategies/body/balance-index.analysis";
export async function body(front: Pose, side: Pose, back: Pose) {
  [front, side, back].forEach((p, i) => assertPose(p, bodyRequired(i)));
  const result = await new BodyStrategy(
    new AnkleAnalysis(),
    new BackAnalysis(),
    new HipJointAnalysis(),
    new KneeAnalysis(),
    new LowerLimbAlignmentAnalysis(),
    new NeckAnalysis(),
    new PelvisAnalysis(),
    new ShoulderAnalysis(),
    new TorsoAnalysis(),
    new UpperArmAnalysis(),
    new BalanceIndexAnalysis(),
  ).execute({ front, right_side: side, back });
  const m = resolveBodyDisplayMetrics(
    { front, right_side: side, back },
    result.scoreDetail,
  );
  const fields: [string, number][] = [
    ["목 기울기", m.front.neckTilt.displayAngle],
    ["어깨 높이 차", m.front.shoulderAsymmetry.displayAngle],
    ["골반 높이 차", m.front.pelvisAsymmetry.displayAngle],
    ["측면 목 편위", m.side.neck.angle],
    ["측면 골반 경사", m.side.pelvisTilt.angle],
    ["오른쪽 무릎", m.side.knee.rightAngle],
  ];
  return {
    metrics: fields
      .filter(([, v]) => Number.isFinite(v))
      .map(([label, value]) => ({
        label,
        value: Math.round(value * 10) / 10,
        unit: "°",
      })),
    referenceStatus: "unverified",
    algorithm: "original-iposture",
  };
}
