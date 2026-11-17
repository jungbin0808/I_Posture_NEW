/**
 * 신체 부위별 기능 점수(scoreUsage) 산출 헬퍼
 * 각 부위 점수 = 해당 부위에 포함된 검사 항목 scoreUsage 중 최솟값
 */

/** 골반 좌우 이동: 정상 허용 차이 (픽셀, 척추정렬검사와 동일 0.3) */
export const PELVIS_LATERAL_SHIFT_NORMAL_TOLERANCE_PX = 0.3;

/** 골반 좌우 이동: 최대 틀어짐 기준값 (픽셀, 트레이너 기준 사진으로 보정) */
export const PELVIS_LATERAL_SHIFT_MAX_DIFF_PX = 60;

export function minScoreUsage(values: Array<number | undefined | null>): number {
  const nums = values.filter((v): v is number => typeof v === 'number');
  return nums.length > 0 ? Math.min(...nums) : 100;
}

/** 값이 클수록 좋음 (angle >= threshold) */
export function scoreUsageFromDescendingThresholds(
  value: number,
  thresholds: Array<{ min: number; scoreUsage: number }>,
): number {
  for (const t of thresholds) {
    if (value > t.min) return t.scoreUsage;
  }
  return thresholds[thresholds.length - 1]?.scoreUsage ?? 30;
}

/** 값이 작을수록 좋음 (value < threshold) */
export function scoreUsageFromAscendingThresholds(
  value: number,
  thresholds: Array<{ max: number; scoreUsage: number }>,
): number {
  for (const t of thresholds) {
    if (value < t.max) return t.scoreUsage;
  }
  return thresholds[thresholds.length - 1]?.scoreUsage ?? 30;
}

/** 값이 작을수록 좋음 (value <= threshold) */
export function scoreUsageFromAscendingMaxThresholds(
  value: number,
  thresholds: Array<{ max: number; scoreUsage: number }>,
): number {
  for (const t of thresholds) {
    if (value <= t.max) return t.scoreUsage;
  }
  return thresholds[thresholds.length - 1]?.scoreUsage ?? 30;
}

/** 스웨이백 편차(골반−발목, px) — 골반이 발목 중심선보다 앞쪽일 때만 적용 */
export function scoreUsageFromSwaybackDeviation(deviationMm: number): number {
  if (deviationMm <= 5) return 100;
  if (deviationMm <= 10) return 80;
  if (deviationMm <= 15) return 70;
  if (deviationMm <= 20) return 60;
  if (deviationMm <= 25) return 50;
  return 30;
}

/** 발 회전 정상 범위·위험 각도 (트레이너 기준 사진으로 보정) */
export const ANKLE_ROTATION_NORMAL_MIN = 85;
export const ANKLE_ROTATION_NORMAL_MAX = 95;
export const ANKLE_ROTATION_OUTWARD_DANGER = 111;
export const ANKLE_ROTATION_INWARD_DANGER = 70;

/** 발 회전 각도 → scoreUsage (외회전·내회전 각각 5등분) */
export function scoreUsageFromAnkleRotationAngle(angle: number): number {
  if (angle >= ANKLE_ROTATION_NORMAL_MIN && angle <= ANKLE_ROTATION_NORMAL_MAX) return 100;

  if (angle > ANKLE_ROTATION_NORMAL_MAX) {
    const range = ANKLE_ROTATION_OUTWARD_DANGER - ANKLE_ROTATION_NORMAL_MAX;
    if (angle >= ANKLE_ROTATION_OUTWARD_DANGER) return 30;
    const ratio = (angle - ANKLE_ROTATION_NORMAL_MAX) / range;
    if (ratio <= 0.2) return 80;
    if (ratio <= 0.4) return 70;
    if (ratio <= 0.6) return 60;
    if (ratio <= 0.8) return 50;
    return 30;
  }

  const range = ANKLE_ROTATION_NORMAL_MIN - ANKLE_ROTATION_INWARD_DANGER;
  if (angle < ANKLE_ROTATION_INWARD_DANGER) return 30;
  const ratio = (ANKLE_ROTATION_NORMAL_MIN - angle) / range;
  if (ratio <= 0.2) return 80;
  if (ratio <= 0.4) return 70;
  if (ratio <= 0.6) return 60;
  if (ratio <= 0.8) return 50;
  return 30;
}

/** 골반 좌우 이동: |L-R| 차이 기준 5등분 */
export function scoreUsageFromPelvisLateralShiftDiff(diffPx: number): number {
  if (diffPx <= PELVIS_LATERAL_SHIFT_NORMAL_TOLERANCE_PX) return 100;

  const max = PELVIS_LATERAL_SHIFT_MAX_DIFF_PX;
  if (diffPx >= max) return 30;

  const range = max - PELVIS_LATERAL_SHIFT_NORMAL_TOLERANCE_PX;
  const ratio = (diffPx - PELVIS_LATERAL_SHIFT_NORMAL_TOLERANCE_PX) / range;
  if (ratio <= 0.2) return 80;
  if (ratio <= 0.4) return 70;
  if (ratio <= 0.6) return 60;
  if (ratio <= 0.8) return 50;
  return 30;
}

/** 무릎 뒤쪽 각도 → scoreUsage (굽힘/과신전 비대칭 구간) */
export function scoreUsageFromKneeAngle(angle: number): number {
  if (angle >= 176.8 && angle < 179.8) return 100;
  if (angle < 163.6) return 30;
  if (angle < 168.0) return 50;
  if (angle < 171.3) return 60;
  if (angle < 174.6) return 70;
  if (angle < 176.8) return 80;
  if (angle < 180.5) return 80;
  if (angle < 181.6) return 70;
  if (angle < 182.8) return 60;
  if (angle < 184.3) return 50;
  return 30;
}

/** 하지정렬 내각(도) → scoreUsage (다리 1개) */
export function scoreUsageFromLegInnerAngle(innerAngle: number): number {
  const bowDev = Math.max(0, 180 - innerAngle);
  const knockDev = Math.max(0, innerAngle - 180);

  if (bowDev <= 4.0 && knockDev <= 3.0) return 100;

  if (bowDev > knockDev) {
    if (bowDev >= 11.2) return 30;
    if (bowDev >= 9.4) return 50;
    if (bowDev >= 7.6) return 60;
    if (bowDev >= 5.8) return 70;
    if (bowDev > 4.0) return 80;
  } else {
    if (knockDev >= 5.0) return 30;
    if (knockDev > 4.5) return 50;
    if (knockDev > 4.0) return 60;
    if (knockDev > 3.5) return 70;
    if (knockDev > 3.0) return 80;
  }

  return 100;
}

/** 신체 부위별 기능 점수에 포함되는 scoreDetail 키 */
export const BODY_PART_SCORE_KEYS = {
  neck: ['neckTurtleRaised', 'neckTilt'] as const,
  shoulder: ['shoulderHeightAsymmetry', 'neckTurtleRaised'] as const,
  pelvis: ['pelvisAsymmetry', 'pelvisMove', 'isSwayBack'] as const,
  lowerLimbAlignment: ['legsBowOrKnock'] as const,
  knee: ['kneesBentOrBack'] as const,
  ankle: ['ankleMove'] as const,
};

export function calculateBodyPartScoreFromDetail(
  scoreDetail: Record<string, any> | undefined,
  keys: readonly string[],
  crossPart?: Record<string, any>,
): number {
  const values = keys.map((key) => {
    if (key === 'neckTurtleRaised' && crossPart?.neck?.neckTurtleRaised) {
      return crossPart.neck.neckTurtleRaised.scoreUsage as number | undefined;
    }
    return scoreDetail?.[key]?.scoreUsage as number | undefined;
  });
  return minScoreUsage(values);
}
