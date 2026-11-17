import { Landmarks, Point } from '../analysis.types';
import { calculateAngle } from './angle.helper';

/** Rt ear이 Rt shoulder보다 앞 — 각도(°)별 추가 하중(kg) */
export const NECK_LOAD_FORWARD_MAP: Record<number, number> = {
  1: 0.8, 2: 1.2, 3: 1.2, 4: 2.1, 5: 2.5, 6: 2.9, 7: 3.3, 8: 4.2, 9: 4.6, 10: 5.0,
  11: 5.4, 12: 5.8, 13: 6.2, 14: 7.1, 15: 7.5, 16: 7.9, 17: 8.3, 18: 9.1, 19: 9.6, 20: 10.0,
  21: 10.8, 22: 11.6, 23: 12.1, 24: 12.9, 25: 13.3, 26: 13.7, 27: 14.5, 28: 15.8, 29: 17.0, 30: 17.9,
  31: 18.3, 32: 19.1, 33: 19.5, 34: 20.8, 35: 21.6,
};

/** Rt ear이 Rt shoulder보다 뒤 — 각도(°)별 추가 하중(kg), 최대 20° */
export const NECK_LOAD_BACKWARD_MAP: Record<number, number> = {
  1: 0.4, 2: 0.8, 3: 1.7, 4: 2.1, 5: 2.7, 6: 3.3, 7: 3.7, 8: 4.2, 9: 4.6, 10: 5.4,
  11: 6.2, 12: 6.7, 13: 7.1, 14: 7.5, 15: 7.9, 16: 8.7, 17: 9.1, 18: 9.6, 19: 10.4, 20: 10.8,
};

const MIN_LOAD_ANGLE_DEG = 1;
const FORWARD_EXTRAPOLATION_PER_DEG = 0.4;
const BACKWARD_MAX_ANGLE = 20;

export type NeckLoadDirection = 'forward' | 'backward' | 'neutral';

/** x 증가 = 앞: 귀가 어깨보다 앞이면 forward */
export function resolveNeckLoadDirection(rightEar: Point, rightShoulder: Point): NeckLoadDirection {
  if (rightEar.x > rightShoulder.x) return 'forward';
  if (rightEar.x < rightShoulder.x) return 'backward';
  return 'neutral';
}

/** 귀–어깨 벡터의 180° 기준 편차(°) */
export function resolveNeckDeviationDegrees(rightEar: Point, rightShoulder: Point): number {
  const angle = calculateAngle(rightEar, rightShoulder, { x: rightShoulder.x, y: 0 });
  return Math.abs(180 - angle);
}

/**
 * 목에 가해지는 추가 하중(kg).
 * 바른 자세 대비 귀가 어깨 기준 앞/뒤로 벗어난 각도에 따라 테이블 조회.
 */
export function calculateNeckLoadKg(rightEar: Point, rightShoulder: Point): number {
  const direction = resolveNeckLoadDirection(rightEar, rightShoulder);
  if (direction === 'neutral') return 0;

  const deviation = resolveNeckDeviationDegrees(rightEar, rightShoulder);
  if (deviation < MIN_LOAD_ANGLE_DEG) return 0;

  const angle = Math.round(deviation);

  if (direction === 'forward') {
    if (angle <= 35) {
      return NECK_LOAD_FORWARD_MAP[angle] ?? 0;
    }
    const base = NECK_LOAD_FORWARD_MAP[35];
    return Math.round((base + (angle - 35) * FORWARD_EXTRAPOLATION_PER_DEG) * 10) / 10;
  }

  const clamped = Math.min(angle, BACKWARD_MAX_ANGLE);
  return NECK_LOAD_BACKWARD_MAP[clamped] ?? 0;
}

/** 측면 랜드마크(right_side) 기준 목 부하(kg) */
export function calculateNeckLoadFromLandmarks(landmarks: Landmarks | null | undefined): number {
  const side = landmarks?.right_side;
  if (!side?.RightEar || !side?.RightShoulder) return 0;
  return calculateNeckLoadKg(side.RightEar, side.RightShoulder);
}
