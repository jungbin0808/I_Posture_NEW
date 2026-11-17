import { SPINAL_ALIGNMENT } from '../analysis.constants';

export type PelvicReactionResult = {
  result: number;
  score: number;
  higherSide: '왼쪽' | '오른쪽' | null;
  isNormal: boolean;
};

/** 구형 atan2(dy,dx) 저장값(~177°) 등을 수평 대비 기울기 각으로 보정 */
export function normalizePelvicAngleDeg(result: number): number {
  const abs = Math.abs(result);
  return abs > 90 ? 180 - abs : abs;
}

export function computePelvicReactionFromHips(
  leftHip: { x: number; y: number },
  rightHip: { x: number; y: number },
): PelvicReactionResult {
  const hipDy = rightHip.y - leftHip.y; // 양수 = 오른쪽 골반 낮음 = 왼쪽 골반 높음
  const hipDxAbs = Math.abs(rightHip.x - leftHip.x);
  const angleDeg = hipDxAbs === 0
    ? 0
    : Math.round(Math.abs(Math.atan2(Math.abs(hipDy), hipDxAbs) * (180 / Math.PI)) * 10) / 10;
  const threshold = SPINAL_ALIGNMENT.PELVIC_ANGLE_THRESHOLD_DEG;
  const isNormal = angleDeg <= threshold;
  const higherSide = isNormal ? null : hipDy > 0 ? '왼쪽' : '오른쪽';
  return { result: angleDeg, score: 0, higherSide, isNormal };
}

/**
 * 척추정렬 리포트용 골반 반응 resolve
 * - 측정 시 저장된 scoreDetail.pelvicReaction 우선 (재측정 결과 반영)
 * - 없을 때만 랜드마크에서 재계산
 */
export function resolvePelvicReaction(
  stored: Partial<PelvicReactionResult> | null | undefined,
  back?: { LeftHip?: { x: number; y: number }; RightHip?: { x: number; y: number } } | null,
): PelvicReactionResult | null {
  if (stored?.result != null && !Number.isNaN(Number(stored.result))) {
    const angleDeg = normalizePelvicAngleDeg(Number(stored.result));
    const threshold = SPINAL_ALIGNMENT.PELVIC_ANGLE_THRESHOLD_DEG;
    const isNormal = stored.isNormal ?? angleDeg <= threshold;
    let higherSide: '왼쪽' | '오른쪽' | null = null;
    if (!isNormal) {
      if (stored.higherSide === '왼쪽' || stored.higherSide === '오른쪽') {
        higherSide = stored.higherSide;
      } else if (back?.LeftHip && back?.RightHip) {
        higherSide = computePelvicReactionFromHips(back.LeftHip, back.RightHip).higherSide;
      }
    }
    return {
      result: angleDeg,
      score: stored.score ?? 0,
      higherSide,
      isNormal,
    };
  }
  if (back?.LeftHip && back?.RightHip) {
    return computePelvicReactionFromHips(back.LeftHip, back.RightHip);
  }
  return null;
}
