import { calculateAngle } from './angle.helper';
import { Point } from '../analysis.types';

export type LegAlignmentStatus = '오다리' | '엑스다리' | '바른정렬';

export interface LegSideAlignment {
  status: LegAlignmentStatus;
  innerAngle: number;
  diffFrom180: number;
}

const BOW_THRESHOLD = 176;
const KNOCK_THRESHOLD = 183;

/** Hip-Knee-Ankle 내각 (정면 하지 정렬) */
export function calcLegInnerAngle(
  hip: Point,
  knee: Point,
  ankle: Point,
  isLeft: boolean,
): number {
  const rawAngle = calculateAngle(knee, hip, ankle);
  const t = (knee.y - hip.y) / (ankle.y - hip.y);
  const lineX = hip.x + t * (ankle.x - hip.x);
  // 정면 비미러: 왼쪽 다리 안쪽=낮은 x, 오른쪽 다리 안쪽=높은 x (OHS calcInnerKneeAngle과 동일)
  const isKnockKnee = isLeft ? knee.x < lineX : knee.x > lineX;
  return isKnockKnee ? 360 - rawAngle : rawAngle;
}

export function classifyLegAlignment(angle: number): LegAlignmentStatus {
  if (angle < BOW_THRESHOLD) return '오다리';
  if (angle > KNOCK_THRESHOLD) return '엑스다리';
  return '바른정렬';
}

export function resolveLegSideAlignment(
  hip: Point,
  knee: Point,
  ankle: Point,
  isLeft: boolean,
): LegSideAlignment {
  const innerAngle = calcLegInnerAngle(hip, knee, ankle, isLeft);
  return {
    status: classifyLegAlignment(innerAngle),
    innerAngle,
    diffFrom180: Math.abs(innerAngle - 180),
  };
}

export interface LegDisplayMetrics {
  left: { status: string; diff: number; angle: number };
  right: { status: string; diff: number; angle: number };
}

/** scoreDetail에 저장된 legsBowOrKnock.result JSON 파싱 (photoAnalysis 등 표시용) */
export function parseLegsBowOrKnockFromScoreDetail(scoreDetail: any): LegDisplayMetrics | null {
  const raw = scoreDetail?.lowerLimbAlignment?.legsBowOrKnock?.result;
  if (!raw || typeof raw !== 'string') return null;

  try {
    const parsed = JSON.parse(raw) as {
      left?: { status?: string; diff?: string | number; angle?: string | number };
      right?: { status?: string; diff?: string | number; angle?: string | number };
    };
    if (!parsed.left?.status || !parsed.right?.status) return null;

    return {
      left: {
        status: parsed.left.status,
        diff: parseFloat(String(parsed.left.diff ?? 0)),
        angle: parseFloat(String(parsed.left.angle ?? 0)),
      },
      right: {
        status: parsed.right.status,
        diff: parseFloat(String(parsed.right.diff ?? 0)),
        angle: parseFloat(String(parsed.right.angle ?? 0)),
      },
    };
  } catch {
    return null;
  }
}
