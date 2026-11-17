import { Landmarks } from '../analysis.types';
import { calculateKneeAngle180Plus } from './angle.helper';
import { resolveNeckDeviationDegrees } from './neck-load.helper';
import { resolvePelvisPtaDegrees, resolvePelvisTilt7Case } from './pelvis-tilt.helper';

export interface HeightLossThetas {
  /** 귀→어깨 각도 (°), 180° 기준 편차 절대값 */
  theta1: number;
  /** 어깨→골반(허리) 각도 (°), 수직 대비 기울기 */
  theta2: number;
  /** 허리→골반 PTA 각도 (°) */
  theta3: number;
  /** 골반–무릎–발목 각도 (°), 180° 기준 편차 절대값 */
  thetaLeg: number;
}

const DEFAULT_HEIGHT_CM = 170;

function resolveTheta2ShoulderToHip(landmarks: Landmarks | null | undefined): number {
  const side = landmarks?.right_side;
  if (!side?.RightShoulder || !side?.RightHip) return 0;

  const dx = Math.abs(side.RightHip.x - side.RightShoulder.x);
  const dy = Math.abs(side.RightHip.y - side.RightShoulder.y);
  if (dy <= 0) return 0;

  return Math.atan2(dx, dy) * (180 / Math.PI);
}

function resolveTheta3PelvisPta(landmarks: Landmarks | null | undefined): number {
  const side = landmarks?.right_side;
  if (!side?.RightAnkle || !side?.RightKnee || !side?.RightHip || !side?.RightShoulder) {
    return 0;
  }

  const rightKneeAngle = calculateKneeAngle180Plus(
    side.RightHip,
    side.RightKnee,
    side.RightAnkle,
  );
  const tilt = resolvePelvisTilt7Case(
    side.RightAnkle,
    side.RightKnee,
    side.RightHip,
    side.RightShoulder,
    rightKneeAngle,
  );

  if (tilt.status === '중립') return 0;

  return resolvePelvisPtaDegrees(
    tilt.tiltCase,
    side.RightHip,
    side.RightKnee,
    side.RightShoulder,
  );
}

function resolveThetaLeg(landmarks: Landmarks | null | undefined): number {
  const deviations: number[] = [];
  const right = landmarks?.right_side;
  const left = landmarks?.left_side ?? landmarks?.right_side;

  if (right?.RightHip && right?.RightKnee && right?.RightAnkle) {
    const angle = calculateKneeAngle180Plus(right.RightHip, right.RightKnee, right.RightAnkle);
    deviations.push(Math.abs(180 - angle));
  }
  if (left?.LeftHip && left?.LeftKnee && left?.LeftAnkle) {
    const angle = calculateKneeAngle180Plus(left.LeftHip, left.LeftKnee, left.LeftAnkle, false);
    deviations.push(Math.abs(180 - angle));
  }

  return deviations.length > 0 ? Math.max(...deviations) : 0;
}

/** 키손실 공식에 쓰이는 4개 각도(°) — 모두 절대값 */
export function resolveHeightLossThetas(landmarks: Landmarks | null | undefined): HeightLossThetas {
  const side = landmarks?.right_side;

  const theta1 =
    side?.RightEar && side?.RightShoulder
      ? Math.abs(resolveNeckDeviationDegrees(side.RightEar, side.RightShoulder))
      : 0;

  return {
    theta1,
    theta2: Math.abs(resolveTheta2ShoulderToHip(landmarks)),
    theta3: Math.abs(resolveTheta3PelvisPta(landmarks)),
    thetaLeg: Math.abs(resolveThetaLeg(landmarks)),
  };
}

/**
 * 키손실(cm) = H(mm) × [0.12(1−cos θ1) + 0.097(1−cos θ2) + 0.09(1−cos θ3) + 0.12(1−cos θLeg)] ÷ 10
 * H: 회원 신장(cm) → mm 변환
 */
export function calculateHeightLossCm(
  heightCm: number | null | undefined,
  landmarks: Landmarks | null | undefined,
): number {
  const heightMm = (heightCm || DEFAULT_HEIGHT_CM) * 10;
  const { theta1, theta2, theta3, thetaLeg } = resolveHeightLossThetas(landmarks);

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const lossMm =
    heightMm *
    (0.12 * (1 - Math.cos(toRadians(theta1))) +
      0.097 * (1 - Math.cos(toRadians(theta2))) +
      0.09 * (1 - Math.cos(toRadians(theta3))) +
      0.12 * (1 - Math.cos(toRadians(thetaLeg))));

  return Math.floor((lossMm / 10) * 10) / 10;
}
