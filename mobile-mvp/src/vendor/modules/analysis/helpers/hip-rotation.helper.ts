import { Point } from '../analysis.types';

export type HipRotationDirection = '안쪽' | '바깥' | '중앙';

/**
 * 엉덩관절(고관절) 외회전 정상범위 — 트레이너 기준 리포트 2건(A/B)의
 * ankle-footIndex 선과 수직선 사이 각도로 보정.
 * 정상 자세는 발끝이 다소 바깥쪽을 향하므로, 정상범위는 0°가 아니라
 * [MIN, MAX] 구간(바깥쪽 방향 기준)으로 정의한다.
 */
export const HIP_ROTATION_NORMAL_MIN_DEG = 6.4;
export const HIP_ROTATION_NORMAL_MAX_DEG = 29.71;

function footTiltFromVerticalDeg(ankle: Point, toe: Point): number {
  const dx = toe.x - ankle.x;
  const dy = ankle.y - toe.y;
  if (Math.abs(dy) < 1e-6) {
    return dx === 0 ? 0 : 90;
  }
  return Math.atan2(Math.abs(dx), Math.abs(dy)) * (180 / Math.PI);
}

/** 바깥쪽 방향을 양수로 하는 부호 있는 각도를 정상범위와 비교해 분류 */
function classifyByNormalRange(signedDeg: number): HipRotationDirection {
  if (signedDeg > HIP_ROTATION_NORMAL_MAX_DEG) return '바깥';
  if (signedDeg < HIP_ROTATION_NORMAL_MIN_DEG) return '안쪽';
  return '중앙';
}

function classifyLeftFootRotation(ankle: Point, toe: Point): HipRotationDirection {
  const tilt = footTiltFromVerticalDeg(ankle, toe);
  const dx = toe.x - ankle.x;
  const signedDeg = dx >= 0 ? tilt : -tilt; // 좌측: dx>0이 바깥쪽
  return classifyByNormalRange(signedDeg);
}

function classifyRightFootRotation(ankle: Point, toe: Point): HipRotationDirection {
  const tilt = footTiltFromVerticalDeg(ankle, toe);
  const dx = toe.x - ankle.x;
  const signedDeg = dx <= 0 ? tilt : -tilt; // 우측: dx<0이 바깥쪽
  return classifyByNormalRange(signedDeg);
}

export function resolveHipFootRotation(
  leftAnkle: Point,
  leftToe: Point,
  rightAnkle: Point,
  rightToe: Point,
): { leftDir: HipRotationDirection; rightDir: HipRotationDirection } {
  return {
    leftDir: classifyLeftFootRotation(leftAnkle, leftToe),
    rightDir: classifyRightFootRotation(rightAnkle, rightToe),
  };
}
