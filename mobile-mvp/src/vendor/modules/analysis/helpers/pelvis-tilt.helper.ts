import { Point } from '../analysis.types';

/** 골반경사 판별: 수직선상 / 앞·뒤 위치 비교 임계값 (px) */
export const PELVIS_TILT_VERTICAL_THRESHOLD_PX = 5;

export type PelvisTiltStatus = '앞기울임' | '뒤기울임' | '중립';
export type PelvisTiltCaseId = '1-A' | '1-B' | '2' | '3' | '4' | '5' | '6' | '7' | 'default';

export interface PelvisTilt7CaseResult {
  status: PelvisTiltStatus;
  tiltCase: PelvisTiltCaseId;
  angle: number;
}

function toDeg(rad: number): number {
  return rad * (180 / Math.PI);
}

/** 상체 기울기 각도 (alpha) */
export function calcPelvisTiltAlpha(hip: Point, shoulder: Point): number {
  return Math.abs(toDeg(Math.atan2(hip.y - shoulder.y, shoulder.x - hip.x)));
}

/** 하체 기울기 각도 (beta) */
export function calcPelvisTiltBeta(hip: Point, knee: Point): number {
  return Math.abs(toDeg(Math.atan2(knee.y - hip.y, hip.x - knee.x)));
}

function isAlignedX(a: number, b: number, threshold = PELVIS_TILT_VERTICAL_THRESHOLD_PX): boolean {
  return Math.abs(a - b) <= threshold;
}

const KNEE_BENT_MAX = 176.8;
const KNEE_BACK_MIN = 179.8;

export function classifySideKneeAngle(angle: number): 'bent' | 'back' | 'normal' {
  if (angle < KNEE_BENT_MAX) return 'bent';
  if (angle >= KNEE_BACK_MIN) return 'back';
  return 'normal';
}

function isKneeBent(angle: number | null | undefined): boolean {
  return angle != null && angle < KNEE_BENT_MAX;
}

function isKneeBack(angle: number | null | undefined): boolean {
  return angle != null && angle >= KNEE_BACK_MIN;
}

/**
 * 골반 전방/후방경사 7-Case 판별 및 각도 산출
 * 좌표계: x 증가 = 앞, y 증가 = 아래
 */
export function resolvePelvisTilt7Case(
  ankle: Point,
  knee: Point,
  hip: Point,
  shoulder: Point,
  rightKneeAngle?: number | null,
): PelvisTilt7CaseResult {
  const t = PELVIS_TILT_VERTICAL_THRESHOLD_PX;

  if (isKneeBent(rightKneeAngle)) {
    return { status: '뒤기울임', tiltCase: '1-A', angle: calcPelvisTiltBeta(hip, knee) };
  }
  if (isKneeBack(rightKneeAngle)) {
    return { status: '앞기울임', tiltCase: '1-B', angle: calcPelvisTiltBeta(hip, knee) };
  }

  const hipAheadOfAnkle = hip.x > ankle.x + t;
  const hipBehindAnkle = hip.x < ankle.x - t;
  const shoulderBehindHip = shoulder.x < hip.x - t;
  const shoulderAheadOfHip = shoulder.x > hip.x + t;
  const shoulderVerticalWithHip = isAlignedX(shoulder.x, hip.x, t);
  const hkaVertical =
    isAlignedX(hip.x, knee.x, t) && isAlignedX(knee.x, ankle.x, t);

  if (hipAheadOfAnkle && shoulderBehindHip) {
    return { status: '뒤기울임', tiltCase: '2', angle: calcPelvisTiltAlpha(hip, shoulder) };
  }
  if (hipBehindAnkle) {
    return { status: '앞기울임', tiltCase: '3', angle: calcPelvisTiltAlpha(hip, shoulder) };
  }
  if (hipAheadOfAnkle && shoulderVerticalWithHip) {
    return { status: '앞기울임', tiltCase: '4', angle: calcPelvisTiltBeta(hip, knee) };
  }
  if (hipAheadOfAnkle && shoulderAheadOfHip) {
    return { status: '앞기울임', tiltCase: '5', angle: calcPelvisTiltAlpha(hip, shoulder) };
  }
  if (hkaVertical && shoulderBehindHip) {
    return { status: '앞기울임', tiltCase: '6', angle: calcPelvisTiltAlpha(hip, shoulder) };
  }
  if (hkaVertical && shoulderAheadOfHip) {
    return { status: '뒤기울임', tiltCase: '7', angle: calcPelvisTiltAlpha(hip, shoulder) };
  }

  return { status: '중립', tiltCase: 'default', angle: 0 };
}

/**
 * 키손실·리포트 표시용 PTA 각도(°).
 * 7-Case 판별용 raw 각도(beta/alpha ≈ 90°)가 아니라, 수직(90°) 대비 편차를 반환합니다.
 */
export function resolvePelvisPtaDegrees(
  tiltCase: PelvisTiltCaseId,
  hip: Point,
  knee: Point,
  shoulder: Point,
): number {
  switch (tiltCase) {
    case '1-A':
    case '1-B':
    case '4':
      return Math.abs(90 - calcPelvisTiltBeta(hip, knee));
    case '2':
    case '3':
    case '5':
    case '6':
    case '7':
      return Math.abs(90 - calcPelvisTiltAlpha(hip, shoulder));
    default:
      return 0;
  }
}
