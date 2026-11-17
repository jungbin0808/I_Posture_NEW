import { getIntersectionPoint } from './intersection.helper';
import { Point } from './point.helper';

export function calculateAngle(a: Point, b: Point, c: Point): number {
  const { x: x1, y: y1 } = a;
  const { x: x2, y: y2 } = b;
  const { x: x3, y: y3 } = c;

  // Vector AB
  const ABx = x2 - x1;
  const ABy = y2 - y1;

  // Vector AC
  const ACx = x3 - x1;
  const ACy = y3 - y1;

  // Angle in radians
  const angle = Math.atan2(ABy, ABx) - Math.atan2(ACy, ACx);

  // Convert angle to degrees (optional)
  let angleInDegrees = angle * (180 / Math.PI);
  // Angle should never be negative
  angleInDegrees = Math.abs(angleInDegrees);
  // Always get the acute representation of the angle
  if (angleInDegrees > 180) {
    angleInDegrees = 360.0 - angleInDegrees;
  }

  return Math.round(angleInDegrees * 100) / 100;
}

/**
 * 무릎(Hip-Knee-Ankle) 및 팔꿈치(Shoulder-Elbow-Wrist) 폄 각도 계산.
 *
 * [문제 배경]
 * calculateAngle()은 항상 0-180° 절댓값만 반환합니다.
 * 따라서 무릎이 앞으로 굽은 경우(굽혀진)와 뒤로 꺾인 경우(과하게 펴진) 모두
 * 동일한 각도가 나와 구분이 불가능합니다.
 *
 * [해결 방법 - 외적(cross product) 방향 판별]
 * (Hip-Knee) × (Ankle-Knee) 외적의 부호로 무릎이 Hip-Ankle 기준선의
 * 앞쪽인지 뒤쪽인지 판단합니다.
 *
 * 이미지 좌표계(y축 아래 방향), right_side 이미지 기준:
 *   cross > 0 → 무릎이 기준선 뒤쪽(등 방향) → 과하게 펴진 → 360° - rawAngle 반환 (>180°)
 *   cross < 0 → 무릎이 기준선 앞쪽(배 방향) → 굽혀진             → rawAngle 그대로 반환 (<180°)
 *   cross = 0 → 완전히 일직선                → 180° 반환
 *
 * [반환 예시]
 *   정상 직선 (true 180°)         → 180°
 *   굽혀진 무릎 (true 170°)       → 170°
 *   과신전 무릎 (true 183°)       → 360 - 177 = 183° (≈true value)
 *
 * @param hip    Hip 랜드마크
 * @param knee   Knee 랜드마크 (각도의 꼭짓점)
 * @param ankle  Ankle 랜드마크
 * @param isLeft 왼쪽 무릎 여부 (측면 촬영 시 과신전 판별 부호가 좌/우 반대)
 */
/** 과신전 보정 최소 내각(°). scoreMapping 하한(174.6)과 맞춤 — 174.76° 등 경계 과신전 포함 */
const KNEE_HYPER_INTERIOR_MIN = 174.6;

export function calculateKneeAngle180Plus(
  hip: Point,
  knee: Point,
  ankle: Point,
  isLeft = false,
): number {
  const interior = calculateAngle(knee, hip, ankle);
  if (interior >= 179.5) return 180;

  // 외적: (Hip-Knee) × (Ankle-Knee)
  const cross =
    (hip.x - knee.x) * (ankle.y - knee.y) -
    (hip.y - knee.y) * (ankle.x - knee.x);

  // 거의 완전히 펴진 상태(>=175°)에서만 과신전 보정. 굽힘(<175°)은 내각 그대로 반환.
  const isHyper = isLeft ? cross < 0 : cross > 0;
  if (isHyper && interior >= KNEE_HYPER_INTERIOR_MIN) {
    return Math.round((360 - interior) * 100) / 100;
  }

  return interior;
}

export function calculateAngleOver180(
  a: Point,
  b: Point,
  c: Point,
  range: number,
): number {
  const angle = calculateAngle(a, b, c);
  if (angle == 180) {
    return angle;
  }
  const angleCheck = calculateAngle(a, new Point(b.x + range, b.y), c);
  if (angleCheck > angle) {
    return 180;
  }
  return angle;
}

export function calculateAngle4Point(a: Point, b: Point, c: Point, d: Point) {
  const pointIntersection = getIntersectionPoint(a, b, c, d);
  if (pointIntersection === null) {
    return 180;
  }
  return calculateAngle(pointIntersection, a, c);
}

export function vectorNorm(v: [number, number]): number {
  return Math.sqrt(v[0] ** 2 + v[1] ** 2);
}

export function calculateAngleBetweenVectors(
  A: Point,
  B: Point,
  C: Point,
  D: Point,
): number {
  const A1 = convertPointToQuadrantIV(A);
  const B1 = convertPointToQuadrantIV(B);
  const C1 = convertPointToQuadrantIV(C);
  const D1 = convertPointToQuadrantIV(D);

  const vectorAB: [number, number] = [B1.x - A1.x, B1.y - A1.y];
  const vectorCD: [number, number] = [D1.x - C1.x, D1.y - C1.y];
  const dotProduct = vectorAB[0] * vectorCD[0] + vectorAB[1] * vectorCD[1];


  const normAB = vectorNorm(vectorAB);
  const normCD = vectorNorm(vectorCD);
  // Port fix: orthogonal vectors are 90 degrees, zero-length vectors are invalid.
  if (normAB === 0 || normCD === 0) return Number.NaN;

  let cosTheta = dotProduct / (normAB * normCD);

  cosTheta = Math.max(-1, Math.min(1, cosTheta));

  const thetaRad = Math.acos(cosTheta);
  const thetaDeg = thetaRad * (180 / Math.PI);

  return thetaDeg;
}

export function convertPointToQuadrantIV(point: { x: number; y: number }): {
  x: number;
  y: number;
} {
  return {
    x: point.x,
    y: -point.y,
  };
}

export type AnkleFlexionMode = 'dorsiflexion' | 'plantarflexion';

/**
 * 발목 DF/PF ROM 각도 (측면 촬영).
 *
 * 시작선(0°): 발목-무릎(정강이) 선에 수직인 선 (꼭짓점: 발목)
 * 측정선: 발목 → foot index
 * 측정값: 시작선과 측정선 사이 각도
 *
 * - Dorsiflexion(발등굽힘): 시작선에서 몸쪽(무릎 방향) → 정상 20°
 * - Plantarflexion(발바닥굽힘): 시작선에서 발끝쪽 → 정상 50°
 */
export function calculateAnkleFlexionAngle(
  ankle: Point,
  knee: Point,
  foot: Point,
  mode: AnkleFlexionMode,
): number {
  const shinX = knee.x - ankle.x;
  const shinY = knee.y - ankle.y;

  // 시작선 벡터: 정강이에 수직 (발목 꼭짓점)
  const baselineX = -shinY;
  const baselineY = shinX;
  const baselinePoint = new Point(ankle.x + baselineX, ankle.y + baselineY);

  const footX = foot.x - ankle.x;
  const footY = foot.y - ankle.y;

  const crossBaselineShin = baselineX * shinY - baselineY * shinX;
  const crossBaselineFoot = baselineX * footY - baselineY * footX;

  const rawAngle = calculateAngleBetweenVectors(ankle, baselinePoint, ankle, foot);

  const footOnBodySide =
    crossBaselineFoot * crossBaselineShin > 0 ||
    (crossBaselineFoot === 0 && shinX * footX + shinY * footY > 0);

  let angle = 0;
  if (mode === 'dorsiflexion' && footOnBodySide) {
    angle = rawAngle;
  } else if (mode === 'plantarflexion' && !footOnBodySide) {
    angle = rawAngle;
  }

  return Math.round(angle * 100) / 100;
}
