import { Landmarks, Point } from '../analysis.types';
import { calculateAngle, calculateKneeAngle180Plus } from './angle.helper';
import { calculateDistance } from './distance.helper';
import { resolveLegSideAlignment, parseLegsBowOrKnockFromScoreDetail } from './leg-alignment.helper';
import { resolveHipFootRotation } from './hip-rotation.helper';
import {
  resolveNeckDeviationDegrees,
  resolveNeckLoadDirection,
} from './neck-load.helper';
import {
  classifySideKneeAngle,
  PelvisTilt7CaseResult,
  resolvePelvisPtaDegrees,
  resolvePelvisTilt7Case,
} from './pelvis-tilt.helper';

/** atan2 raw 각도 → 표시용 보정 */
export function fixDisplayAngle(a: number): number {
  return a > 90 ? 180 - a : a;
}

/** scoreDetail result (`상태:각도`) → 대시보드·DB 저장용 보정 각도 */
export function parseAsymmetryAngleFromResult(result: string | undefined | null): number {
  const raw = parseFloat((result ?? '').split(':')[1] ?? '');
  if (!Number.isFinite(raw)) return 0;
  return parseFloat(fixDisplayAngle(Math.abs(raw)).toFixed(1));
}

/**
 * 체형 리포트 정면 상세분석 문구와 동일한 골반 비대칭 각도.
 * resolveBodyDisplayMetrics + photo-analysis.builder의 displayAngle.toFixed(0)와 동일.
 */
export function resolvePelvisAsymmetryReportAngle(landmarks: Landmarks | null | undefined): number {
  const front = landmarks?.front;
  if (!front?.LeftHip || !front?.RightHip) return 0;
  const { displayAngle } = resolvePelvisAsymmetry(front.LeftHip, front.RightHip);
  return Math.round(displayAngle);
}

export type LateralPosition = 'left' | 'right' | 'center';
export type SidePositionLabel = '앞쪽' | '뒤쪽' | '같은 수직선상';
export type ShoulderAsymStatus = '낮은' | '높은' | '동일한';
export type PelvisAsymStatus = '올라간' | '내려간' | '동일한';
export type SideKneeStatus = '굽혀진' | '과하게 펴진' | '중립';

export interface BodyDisplayMetrics {
  back: {
    hasLandmarks: boolean;
    pelvisPosition: LateralPosition;
    torsoAlignment: LateralPosition;
    lh: number;
    rh: number;
    ls: number;
    rs: number;
  };
  front: {
    neckTilt: { direction: string; rawAngle: number; displayAngle: number };
    neckRotation: { direction: string; angle: number };
    shoulderAsymmetry: { status: ShoulderAsymStatus; rawAngle: number; displayAngle: number };
    raisedDropped: { leftState: string; rightState: string };
    pelvisAsymmetry: { status: PelvisAsymStatus; rawAngle: number; displayAngle: number };
    pelvisRotation: { direction: string; angle: number };
    hipRotation: { leftDir: string; rightDir: string };
    legs: {
      left: { status: string; diff: number; angle: number };
      right: { status: string; diff: number; angle: number };
    };
  };
  side: {
    hasLandmarks: boolean;
    pelvisSidePosition: SidePositionLabel;
    pelvisDistanceSigned: number;
    trunkRelative: SidePositionLabel;
    neck: { positionLabel: SidePositionLabel; angle: number; earAnkleDiff: number | null };
    shoulder: { positionLabel: string; distance: number };
    pelvisTilt: PelvisTilt7CaseResult & { label: string };
    knee: { status: SideKneeStatus; rightAngle: number };
  };
}

const BACK_HIP_THRESHOLD_PX = 5;
const BACK_TORSO_THRESHOLD = 0.05;
const SIDE_POSITION_THRESHOLD_PX = 5;
const TRUNK_RELATIVE_THRESHOLD_PX = 1;
const SHOULDER_SIDE_THRESHOLD_PX = 1;

function resolveBackPelvisPosition(back: Record<string, Point>): {
  position: LateralPosition;
  lh: number;
  rh: number;
  ls: number;
  rs: number;
} {
  const ankleCenter = (back.LeftAnkle.x + back.RightAnkle.x) / 2;
  const lh = Math.abs(back.LeftHip.x - ankleCenter);
  const rh = Math.abs(back.RightHip.x - ankleCenter);
  const ls = Math.abs(back.LeftShoulder.x - ankleCenter);
  const rs = Math.abs(back.RightShoulder.x - ankleCenter);

  let position: LateralPosition = 'center';
  if (lh - rh > BACK_HIP_THRESHOLD_PX) position = 'left';
  else if (rh - lh > BACK_HIP_THRESHOLD_PX) position = 'right';

  return { position, lh, rh, ls, rs };
}

function resolveBackTorsoAlignment(ls: number, rs: number, lh: number, rh: number): LateralPosition {
  if (ls <= 0 || lh <= 0) return 'center';
  const s = rs / ls;
  const h = rh / lh;
  if (s / h > 1 + BACK_TORSO_THRESHOLD) return 'right';
  if (s / h < 1 - BACK_TORSO_THRESHOLD) return 'left';
  return 'center';
}

function resolveNeckTilt(
  leftEar: Point,
  rightEar: Point,
): { direction: string; rawAngle: number; displayAngle: number } {
  const dy = rightEar.y - leftEar.y;
  const dx = rightEar.x - leftEar.x;
  const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
  const rawAngle = Math.abs(angleDeg);
  let direction = '중앙';
  if (angleDeg > 1) direction = '오른쪽';
  else if (angleDeg < -1) direction = '왼쪽';
  return { direction, rawAngle, displayAngle: fixDisplayAngle(rawAngle) };
}

function resolveNeckRotation(
  leftEar: Point,
  rightEar: Point,
  nose: Point,
): { direction: string; angle: number } {
  const ab = calculateDistance(leftEar, nose);
  const bc = calculateDistance(nose, rightEar);
  const percent = Math.round(Math.abs((ab - bc) / ((ab + bc) / 2)) * 100) / 100;
  const angle = Math.asin(Math.min(percent, 1)) * (180 / Math.PI);
  let direction = '중앙';
  if (percent > 0.05) direction = ab > bc ? '오른쪽' : '왼쪽';
  return { direction, angle };
}

function resolveShoulderAsymmetry(
  leftShoulder: Point,
  rightShoulder: Point,
): { status: ShoulderAsymStatus; rawAngle: number; displayAngle: number } {
  const dy = rightShoulder.y - leftShoulder.y;
  const dx = rightShoulder.x - leftShoulder.x;
  const tiltDeg = Math.atan2(Math.abs(dy), Math.abs(dx)) * (180 / Math.PI);
  let status: ShoulderAsymStatus = '동일한';
  if (Math.round(tiltDeg) >= 1) {
    status = dy > 0 ? '낮은' : '높은';
  }
  return { status, rawAngle: tiltDeg, displayAngle: Math.round(tiltDeg) };
}

function resolveRaisedDroppedShoulder(
  leftEar: Point,
  leftShoulder: Point,
  leftHip: Point,
  rightEar: Point,
  rightShoulder: Point,
  rightHip: Point,
): { leftState: string; rightState: string } {
  const leftPercent = Math.round((calculateDistance(leftEar, leftShoulder) / calculateDistance(leftShoulder, leftHip)) * 100) / 100;
  const rightPercent = Math.round((calculateDistance(rightEar, rightShoulder) / calculateDistance(rightShoulder, rightHip)) * 100) / 100;

  const toState = (percent: number): string => {
    if (percent <= 0.29) return '올라간';
    if (percent >= 0.55) return '처진';
    return '양호한';
  };

  if (
    (leftPercent === 0.5 && rightPercent === 0.5) ||
    (toState(leftPercent) === '올라간' && toState(rightPercent) === '처진') ||
    (toState(leftPercent) === '처진' && toState(rightPercent) === '올라간') ||
    (toState(leftPercent) === '올라간' && toState(rightPercent) === '올라간') ||
    (toState(leftPercent) === '처진' && toState(rightPercent) === '처진')
  ) {
    return { leftState: '양호한', rightState: '양호한' };
  }

  return { leftState: toState(leftPercent), rightState: toState(rightPercent) };
}

function resolvePelvisAsymmetry(
  leftHip: Point,
  rightHip: Point,
): { status: PelvisAsymStatus; rawAngle: number; displayAngle: number } {
  const dy = rightHip.y - leftHip.y;
  const dx = rightHip.x - leftHip.x;
  const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
  const rawAngle = Math.abs(angleDeg);
  let status: PelvisAsymStatus = '동일한';
  if (angleDeg > 1) status = '내려간';
  else if (angleDeg < -1) status = '올라간';
  return { status, rawAngle, displayAngle: fixDisplayAngle(rawAngle) };
}

function resolvePelvisRotation(
  frontLeftHip: Point,
  frontRightHip: Point,
  backLeftHip: Point,
  backRightHip: Point,
  sideLeftHip: Point,
  sideRightHip: Point,
): { direction: string; angle: number } {
  const f = calculateDistance(frontLeftHip, frontRightHip);
  const b = calculateDistance(backLeftHip, backRightHip);
  const s = calculateDistance(sideLeftHip, sideRightHip);
  const w = Math.max(f, b);
  const r = Math.min(1, s / w);
  const angle = Math.asin(r) * (180 / Math.PI);

  let direction = '중앙';
  if (sideLeftHip.x < sideRightHip.x) direction = '오른쪽';
  else if (sideLeftHip.x > sideRightHip.x) direction = '왼쪽';

  return { direction, angle };
}

function resolveSidePelvisPosition(hip: Point, ankle: Point): {
  label: SidePositionLabel;
  distanceSigned: number;
} {
  const diff = hip.x - ankle.x;
  const t = SIDE_POSITION_THRESHOLD_PX;
  const label: SidePositionLabel =
    Math.abs(diff) <= t ? '같은 수직선상' : diff > 0 ? '앞쪽' : '뒤쪽';
  const distanceSigned = label === '같은 수직선상' ? 0 : Math.round(diff);
  return { label, distanceSigned };
}

function resolveTrunkRelativeToPelvis(
  shoulder: Point,
  hip: Point,
  ankle: Point,
): SidePositionLabel {
  const hipOffset = hip.x - ankle.x;
  const shoulderOffset = shoulder.x - ankle.x;
  const rel = shoulderOffset - hipOffset;
  if (rel > TRUNK_RELATIVE_THRESHOLD_PX) return '앞쪽';
  if (rel < -TRUNK_RELATIVE_THRESHOLD_PX) return '뒤쪽';
  return '같은 수직선상';
}

function resolveNeckSidePosition(
  rightEar: Point,
  rightShoulder: Point,
): { positionLabel: SidePositionLabel; angle: number } {
  const direction = resolveNeckLoadDirection(rightEar, rightShoulder);
  const positionLabel: SidePositionLabel =
    direction === 'forward' ? '앞쪽'
      : direction === 'backward' ? '뒤쪽'
        : '같은 수직선상';
  return { positionLabel, angle: resolveNeckDeviationDegrees(rightEar, rightShoulder) };
}

function resolveShoulderSidePosition(
  rightShoulder: Point,
  rightAnkle: Point,
): { positionLabel: string; distance: number } {
  const diff = rightShoulder.x - rightAnkle.x;
  const distance = Math.abs(diff);
  const positionLabel =
    diff > SHOULDER_SIDE_THRESHOLD_PX ? '앞'
      : diff < -SHOULDER_SIDE_THRESHOLD_PX ? '뒤'
        : '같은 수직선상';
  return { positionLabel, distance };
}

function resolveSideKneeStatus(
  hip: Point,
  knee: Point,
  ankle: Point,
): { status: SideKneeStatus; angle: number } {
  const angle = calculateKneeAngle180Plus(hip, knee, ankle);
  const classified = classifySideKneeAngle(angle);
  const status: SideKneeStatus =
    classified === 'bent' ? '굽혀진'
      : classified === 'back' ? '과하게 펴진'
        : '중립';
  return { status, angle };
}

function pelvisTiltToLabel(status: string): string {
  if (status.includes('앞')) return '전방경사';
  if (status.includes('뒤')) return '후방경사';
  return '중립';
}

const emptyFront = {
  neckTilt: { direction: '중앙', rawAngle: 0, displayAngle: 0 },
  neckRotation: { direction: '중앙', angle: 0 },
  shoulderAsymmetry: { status: '동일한' as ShoulderAsymStatus, rawAngle: 0, displayAngle: 0 },
  raisedDropped: { leftState: '양호한', rightState: '양호한' },
  pelvisAsymmetry: { status: '동일한' as PelvisAsymStatus, rawAngle: 0, displayAngle: 0 },
  pelvisRotation: { direction: '중앙', angle: 0 },
  hipRotation: { leftDir: '중앙', rightDir: '중앙' },
  legs: {
    left: { status: '', diff: 0, angle: 180 },
    right: { status: '', diff: 0, angle: 180 },
  },
};

const emptySide = {
  hasLandmarks: false,
  pelvisSidePosition: '같은 수직선상' as SidePositionLabel,
  pelvisDistanceSigned: 0,
  trunkRelative: '같은 수직선상' as SidePositionLabel,
  neck: { positionLabel: '같은 수직선상' as SidePositionLabel, angle: 0, earAnkleDiff: null as number | null },
  shoulder: { positionLabel: '같은 수직선상', distance: 0 },
  pelvisTilt: {
    status: '중립',
    tiltCase: 'default',
    angle: 0,
    label: '중립',
  } as PelvisTilt7CaseResult & { label: string },
  knee: { status: '중립' as SideKneeStatus, rightAngle: 180 },
};

/**
 * 체형 리포트 표시용 수치·상태를 랜드마크에서 계산합니다.
 * measurement-report / skeleton-wording 공통 소스입니다.
 */
export function resolveBodyDisplayMetrics(
  landmarks: Landmarks | null | undefined,
  scoreDetail?: any,
): BodyDisplayMetrics {
  const back = landmarks?.back;
  const front = landmarks?.front;
  const side = landmarks?.right_side;

  const hasBackLm = !!(
    back?.LeftAnkle && back?.RightAnkle &&
    back?.LeftHip && back?.RightHip &&
    back?.LeftShoulder && back?.RightShoulder
  );

  let backMetrics = {
    hasLandmarks: false,
    pelvisPosition: 'center' as LateralPosition,
    torsoAlignment: 'center' as LateralPosition,
    lh: 0,
    rh: 0,
    ls: 0,
    rs: 0,
  };

  if (hasBackLm) {
    const pelvis = resolveBackPelvisPosition(back!);
    backMetrics = {
      hasLandmarks: true,
      pelvisPosition: pelvis.position,
      torsoAlignment: resolveBackTorsoAlignment(pelvis.ls, pelvis.rs, pelvis.lh, pelvis.rh),
      lh: pelvis.lh,
      rh: pelvis.rh,
      ls: pelvis.ls,
      rs: pelvis.rs,
    };
  }

  let frontMetrics = { ...emptyFront };

  if (
    front?.LeftEar && front?.LeftShoulder && front?.RightEar && front?.RightShoulder && front?.Nose
  ) {
    frontMetrics.neckTilt = resolveNeckTilt(front.LeftEar, front.RightEar);
    frontMetrics.neckRotation = resolveNeckRotation(front.LeftEar, front.RightEar, front.Nose);
  }

  if (front?.LeftShoulder && front?.RightShoulder) {
    frontMetrics.shoulderAsymmetry = resolveShoulderAsymmetry(front.LeftShoulder, front.RightShoulder);
  }

  if (
    front?.LeftEar && front?.LeftShoulder && front?.LeftHip &&
    front?.RightEar && front?.RightShoulder && front?.RightHip
  ) {
    frontMetrics.raisedDropped = resolveRaisedDroppedShoulder(
      front.LeftEar, front.LeftShoulder, front.LeftHip,
      front.RightEar, front.RightShoulder, front.RightHip,
    );
  }

  if (front?.LeftHip && front?.RightHip) {
    frontMetrics.pelvisAsymmetry = resolvePelvisAsymmetry(front.LeftHip, front.RightHip);
  }

  if (
    front?.LeftHip && front?.RightHip &&
    back?.LeftHip && back?.RightHip &&
    side?.LeftHip && side?.RightHip
  ) {
    frontMetrics.pelvisRotation = resolvePelvisRotation(
      front.LeftHip, front.RightHip,
      back.LeftHip, back.RightHip,
      side.LeftHip, side.RightHip,
    );
  }

  const leftToe = front?.LeftFootIndex || front?.LeftToe;
  const rightToe = front?.RightFootIndex || front?.RightToe;
  if (front?.LeftAnkle && leftToe && front?.RightAnkle && rightToe) {
    frontMetrics.hipRotation = resolveHipFootRotation(
      front.LeftAnkle, leftToe,
      front.RightAnkle, rightToe,
    );
  }

  if (
    front?.LeftHip && front?.LeftKnee && front?.LeftAnkle &&
    front?.RightHip && front?.RightKnee && front?.RightAnkle
  ) {
    const leftLeg = resolveLegSideAlignment(front.LeftHip, front.LeftKnee, front.LeftAnkle, true);
    const rightLeg = resolveLegSideAlignment(front.RightHip, front.RightKnee, front.RightAnkle, false);
    frontMetrics.legs = {
      left: { status: leftLeg.status, diff: leftLeg.diffFrom180, angle: leftLeg.innerAngle },
      right: { status: rightLeg.status, diff: rightLeg.diffFrom180, angle: rightLeg.innerAngle },
    };
  }

  const hasSideLm = !!(side?.RightHip && side?.RightAnkle);
  let sideMetrics = { ...emptySide };

  if (hasSideLm) {
    const pelvisPos = resolveSidePelvisPosition(side!.RightHip, side!.RightAnkle);
    const rightKneeAngle =
      side?.RightKnee
        ? calculateKneeAngle180Plus(side.RightHip, side.RightKnee, side.RightAnkle)
        : null;

    let pelvisTiltResult: PelvisTilt7CaseResult = { status: '중립', tiltCase: 'default', angle: 0 };
    if (side?.RightKnee && side?.RightShoulder) {
      pelvisTiltResult = resolvePelvisTilt7Case(
        side.RightAnkle,
        side.RightKnee,
        side.RightHip,
        side.RightShoulder,
        rightKneeAngle,
      );
    }

    let trunkRelative: SidePositionLabel = '같은 수직선상';
    if (side?.RightShoulder) {
      trunkRelative = resolveTrunkRelativeToPelvis(side.RightShoulder, side.RightHip, side.RightAnkle);
    }

    let neckMetrics = { positionLabel: '같은 수직선상' as SidePositionLabel, angle: 0, earAnkleDiff: null as number | null };
    if (side?.RightEar && side?.RightShoulder) {
      const neck = resolveNeckSidePosition(side.RightEar, side.RightShoulder);
      neckMetrics = {
        positionLabel: neck.positionLabel,
        angle: neck.angle,
        earAnkleDiff: side.RightAnkle ? side.RightEar.x - side.RightAnkle.x : null,
      };
    }

    let shoulderMetrics = { positionLabel: '같은 수직선상', distance: 0 };
    if (side?.RightShoulder) {
      shoulderMetrics = resolveShoulderSidePosition(side.RightShoulder, side.RightAnkle);
    }

    let kneeMetrics = { status: '중립' as SideKneeStatus, rightAngle: 180 };
    if (side?.RightKnee) {
      const knee = resolveSideKneeStatus(side.RightHip, side.RightKnee, side.RightAnkle);
      kneeMetrics = { status: knee.status, rightAngle: knee.angle };
    }

    sideMetrics = {
      hasLandmarks: true,
      pelvisSidePosition: pelvisPos.label,
      pelvisDistanceSigned: pelvisPos.distanceSigned,
      trunkRelative,
      neck: neckMetrics,
      shoulder: shoulderMetrics,
      pelvisTilt: {
        ...pelvisTiltResult,
        angle: pelvisTiltResult.status === '중립'
          ? 0
          : resolvePelvisPtaDegrees(
            pelvisTiltResult.tiltCase,
            side.RightHip,
            side.RightKnee,
            side.RightShoulder,
          ),
        label: pelvisTiltToLabel(pelvisTiltResult.status),
      },
      knee: kneeMetrics,
    };
  }

  const legsFromScoreDetail = parseLegsBowOrKnockFromScoreDetail(scoreDetail);
  if (legsFromScoreDetail) {
    frontMetrics.legs = legsFromScoreDetail;
  }

  return {
    back: backMetrics,
    front: frontMetrics,
    side: sideMetrics,
  };
}

/** 스켈레톤 매칭용 — resolveBodyDisplayMetrics 결과에서 분류 추출 */
export function metricsToSkeletonWording(metrics: BodyDisplayMetrics) {
  const shoulderAsym =
    metrics.front.shoulderAsymmetry.status === '낮은' ? 'left_high'
      : metrics.front.shoulderAsymmetry.status === '높은' ? 'right_high'
        : 'normal';

  const leftLeg = metrics.front.legs.left.status;
  const rightLeg = metrics.front.legs.right.status;
  const legType =
    leftLeg === '엑스다리' || rightLeg === '엑스다리' ? 'knock'
      : leftLeg === '오다리' || rightLeg === '오다리' ? 'bow'
        : 'normal';

  const hasSwayback = metrics.side.pelvisSidePosition === '앞쪽';

  const pelvisTilt =
    hasSwayback ? 'normal'
      : metrics.side.pelvisTilt.status.includes('앞') ? 'forward'
        : metrics.side.pelvisTilt.status.includes('뒤') ? 'backward'
          : 'normal';

  const kneeType =
    metrics.side.knee.status === '굽혀진' ? 'bent'
      : metrics.side.knee.status === '과하게 펴진' ? 'back'
        : 'normal';

  return {
    pelvisMove: metrics.back.pelvisPosition,
    shoulderAsym,
    legType,
    hasSwayback,
    pelvisTilt,
    kneeType,
  };
}
