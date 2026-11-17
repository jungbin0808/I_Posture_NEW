import { Point } from '../analysis.types';
import { BALANCE_ALIGNMENT } from '../analysis.constants';
import { calcLegInnerAngle } from './leg-alignment.helper';

export type SupportingLegAlignmentStatus = '바른정렬' | 'valgus' | '엑스다리' | '오다리';

export interface SupportingLegAlignmentResult {
  status: SupportingLegAlignmentStatus;
  distKnee: number;
  distAnkle: number;
  angleHka: number;
}

/** Axis_A(든 다리 무릎 수직선)으로부터 수평 거리 [px] */
export function resolveDistFromAxis(axisX: number, pointX: number): number {
  return Math.abs(pointX - axisX);
}

/**
 * 지지다리 정렬 판별 (docs/0-1_지지다리_정렬상태_측정방식.md)
 * 1단계: distKnee vs distAnkle
 * 2단계: Angle_HKA (hip·knee·ankle 무릎 내각)
 */
export function classifySupportingLegAlignment(
  distKnee: number,
  distAnkle: number,
  angleHka: number,
  distEqualEpsilonPx = BALANCE_ALIGNMENT.SUPPORTING_LEG_DIST_EQUAL_EPSILON_PX,
): SupportingLegAlignmentStatus {
  if (distKnee < distAnkle - distEqualEpsilonPx) {
    return 'valgus';
  }

  if (Math.abs(distKnee - distAnkle) <= distEqualEpsilonPx) {
    return angleHka <= BALANCE_ALIGNMENT.SUPPORTING_LEG_ANGLE_NORMAL_MAX
      ? '바른정렬'
      : '엑스다리';
  }

  if (
    angleHka >= BALANCE_ALIGNMENT.SUPPORTING_LEG_ANGLE_NORMAL_MIN
    && angleHka <= BALANCE_ALIGNMENT.SUPPORTING_LEG_ANGLE_NORMAL_MAX
  ) {
    return '바른정렬';
  }
  if (angleHka < BALANCE_ALIGNMENT.SUPPORTING_LEG_ANGLE_NORMAL_MIN) {
    return '오다리';
  }
  return '엑스다리';
}

export function resolveSupportingLegAlignment(
  axisKnee: Point,
  hip: Point,
  knee: Point,
  ankle: Point,
  isLeftSupport: boolean,
): SupportingLegAlignmentResult {
  const distKnee = resolveDistFromAxis(axisKnee.x, knee.x);
  const distAnkle = resolveDistFromAxis(axisKnee.x, ankle.x);
  const angleHka = calcLegInnerAngle(hip, knee, ankle, isLeftSupport);
  const status = classifySupportingLegAlignment(distKnee, distAnkle, angleHka);

  return { status, distKnee, distAnkle, angleHka };
}
