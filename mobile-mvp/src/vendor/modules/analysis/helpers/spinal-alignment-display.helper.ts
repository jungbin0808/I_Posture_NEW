import { Point } from '../analysis.types';

/** 회원 키 미입력 시 기본값(cm) — 여성 필라테스 기준 */
const DEFAULT_BODY_HEIGHT_CM = 168;
const PREVIEW_BODY_HEIGHT_RATIO = 0.75;
const MIN_BODY_SPAN_PX = 50;

type BackLandmarks = Record<string, Point | undefined>;

export type SpinalScaleOptions = {
  /** 회원 신장(cm) — user.height */
  heightCm?: number | null;
  previewHeight?: number | null;
};

/** 후면 랜드마크에서 화면上 신체 세로 span(px) */
export function estimateBodySpanPx(back?: BackLandmarks | null): number | null {
  if (!back) return null;

  let topY = Infinity;
  let bottomY = -Infinity;

  const topCandidates = [
    back.Nose,
    back.LeftEar,
    back.RightEar,
    back.LeftShoulder,
    back.RightShoulder,
  ];
  const bottomCandidates = [
    back.LeftAnkle,
    back.RightAnkle,
    back.LeftHeel,
    back.RightHeel,
  ];

  for (const p of topCandidates) {
    if (p?.y != null) topY = Math.min(topY, p.y);
  }
  for (const p of bottomCandidates) {
    if (p?.y != null) bottomY = Math.max(bottomY, p.y);
  }

  if (topY === Infinity || bottomY <= topY) return null;
  return bottomY - topY;
}

/**
 * 회원 신장(cm)과 화면 신체 span(px)으로 가로 1cm당 픽셀 수 추정.
 * span = 회원 키(cm) → |centerShoulderHip.result| px를 cm로 환산.
 */
export function estimateHorizontalPxPerCm(
  back?: BackLandmarks | null,
  options?: SpinalScaleOptions,
): number {
  const heightCm = options?.heightCm && options.heightCm > 0
    ? options.heightCm
    : DEFAULT_BODY_HEIGHT_CM;

  const bodySpanPx = estimateBodySpanPx(back);
  if (bodySpanPx != null && bodySpanPx >= MIN_BODY_SPAN_PX) {
    return bodySpanPx / heightCm;
  }

  const previewHeight = options?.previewHeight && options.previewHeight > 0
    ? options.previewHeight
    : 1920;
  return (previewHeight * PREVIEW_BODY_HEIGHT_RATIO) / heightCm;
}

/** 상체 중심 이동 px → 표시용 cm (소수 1자리) */
export function centerShiftPxToDisplayCm(shiftPx: number, pxPerCm: number): number {
  if (!pxPerCm || pxPerCm <= 0) return 0;
  return Math.round((Math.abs(shiftPx) / pxPerCm) * 10) / 10;
}

export function formatCenterShiftDistanceCm(shiftPx: number, pxPerCm: number): string {
  return centerShiftPxToDisplayCm(shiftPx, pxPerCm).toFixed(1);
}

export function formatCenterShiftMetricLabel(
  spinalTilt: { result?: number; disease?: string } | null | undefined,
  pxPerCm: number,
): string {
  if (!spinalTilt) return '데이터 없음';
  if (spinalTilt.disease === 'NORMAL') return '수직 정렬';

  const cm = formatCenterShiftDistanceCm(spinalTilt.result ?? 0, pxPerCm);
  return (spinalTilt.result ?? 0) > 0 ? `오른쪽 ${cm}cm →` : `왼쪽 ${cm}cm ←`;
}
