import { PRECISE_DISEASES } from '../../../common/enums/precise-diseases.enum';
import { Point } from '../helpers/point.helper';
import { calculateAngleBetweenVectors } from '../helpers/angle.helper';
import { AnalyticResult } from './analytic.result';
import { AnalyticStrategy } from './analytic.strategy';
import { DiseaseResult, Landmarks } from '../analysis.types';
import { getHypermobilityLevel, HYPER_STAGES } from '../helpers/hypermobility.helper';

/**
 * 머리돹(Trunk/Torso) ROM 측정 전략
 *
 * 측정 항목:
 *   - 가쪽굽힘(Lateral Flexion) 좌/우: 몸통을 옆으로 수바는 동작 → 정상 35°
 *   - 굽힘(Flexion): 몸통을 앞으로 숙이는 동작 → 정상 90°
 *   - 폴(Extension): 몸통을 뒤로 제치는 동작 → 정상 30°
 *   - 회전(Rotation) 좌/우: 몸통을 좌우로 돌리는 동작 → 정상 30(점수)
 *
 * 좌표계: 화면 픽셀 좌표 (x: 왼쪽→오른쪽, y: 위→아래)
 */
/** 스펙 원각(°) → 리포트 표시각 보정 계수 (QA 보정치, 스펙 공식과 분리 적용) */
const TRUNK_ROTATION_CORRECTION = 3.75;
const TRUNK_ROTATION_NORMAL_DEG = 30;

/**
 * 몸통 회전 스펙 각도(25·26번 공통).
 * Hip_mid 기준 수직 위(0,-1)와 Shoulder_mid−Hip_mid 벡터 사이 각도(°).
 */
function measureTrunkRotationSpecDeg(landmarks: Record<string, { x: number; y: number }>): number | null {
  const rh = landmarks.RightHip;
  const lh = landmarks.LeftHip;
  const rs = landmarks.RightShoulder;
  const ls = landmarks.LeftShoulder;
  if (!rh || !lh || !rs || !ls) return null;

  const trunkY = (rs.y + ls.y) / 2 - (rh.y + lh.y) / 2;
  const trunkMag = Math.hypot(
    (rs.x + ls.x) / 2 - (rh.x + lh.x) / 2,
    trunkY,
  );
  if (trunkMag <= 0) return null;

  // 이미지 좌표계: V_vertical = (0, -1)
  const cosTheta = Math.max(-1, Math.min(1, -trunkY / trunkMag));
  return Math.acos(cosTheta) * (180 / Math.PI);
}

function buildTrunkRotationResponse(
  rawTheta: number,
  diseaseKey: string,
): {
  max: string;
  score: number;
  result: number;
  rawAngle: number;
  disease: string;
  scoreUsage: number;
  scoreMapping: [];
} {
  const correctedAngle = Math.min(
    rawTheta * TRUNK_ROTATION_CORRECTION,
    TRUNK_ROTATION_NORMAL_DEG,
  );
  const isNormal = correctedAngle >= TRUNK_ROTATION_NORMAL_DEG;

  return {
    max: String(TRUNK_ROTATION_NORMAL_DEG),
    score: Math.min(Math.round((correctedAngle / TRUNK_ROTATION_NORMAL_DEG) * 100), 100),
    result: correctedAngle,
    rawAngle: rawTheta,
    disease: isNormal ? 'NORMAL' : diseaseKey,
    scoreUsage: 0,
    scoreMapping: [],
  };
}

export class TorsoStrategy implements AnalyticStrategy {
  async execute(landmarks: Landmarks): Promise<AnalyticResult> {
    const disease: DiseaseResult[] = [];
    const scoreDetail = {
      sideBendingRight: landmarks?.start_side_bend_right ? this.checkSideBendingRight(
        landmarks.start_side_bend_right.RightHip,
        landmarks.start_side_bend_right.LeftHip,
        landmarks.end_side_bend_right.RightShoulder,
        landmarks.end_side_bend_right.LeftShoulder,
        landmarks.end_side_bend_right.RightHip,
        landmarks.end_side_bend_right.LeftHip,
      ) : null,
      sideBendingLeft: landmarks?.start_side_bend_left ? this.checkSideBendingLeft(
        landmarks.start_side_bend_left.RightHip, // start_side_bend_left로 수정 (기존 코드에 오타 있었음)
        landmarks.start_side_bend_left.LeftHip,
        landmarks.end_side_bend_left.RightShoulder,
        landmarks.end_side_bend_left.LeftShoulder,
        landmarks.end_side_bend_left.RightHip,
        landmarks.end_side_bend_left.LeftHip,
      ) : null,
      bending: landmarks?.start_bend_right ? this.checkBending(
        landmarks.start_bend_right.RightHip,
        landmarks.end_bend_right.RightHip,
        landmarks.end_bend_right.RightShoulder,
      ) : null,
      straightening: landmarks?.start_straighten_left ? this.checkStraightening(
        landmarks.start_straighten_left.RightHip,
        landmarks.end_straighten_left.RightHip,
        landmarks.end_straighten_left.RightShoulder,
      ) : null,
      rotationRight: landmarks?.start_rotation_right ? this.checkRotationRight(
        landmarks.start_rotation_right,
        landmarks.end_rotation_right,
      ) : null,
      rotationLeft: landmarks?.start_rotation_left ? this.checkRotationLeft(
        landmarks.start_rotation_left,
        landmarks.end_rotation_left,
      ) : null,
    };

    Object.values(scoreDetail).forEach(detail => {
      if (detail && detail.disease !== 'NORMAL') {
        disease.push({
          key: detail.disease,
          level: (detail as any).hypermobilityLevel || '',
          score: 0,
        });
      }
    });

    return new AnalyticResult(0, scoreDetail, disease);
  }
  /**
   * 몸통 오른쪽 가쪽굽힘 (Right Trunk Lateral Flexion) 각도 계산
   *
   * 사용 랜드마크 (정면 촬영):
   *   midHip:      끝 자세 양쪽 골반 중심점 → 기준 축
   *   midShoulder: 끝 자세 양쪽 어깨 중심점 → 상체 곽네 방향 측정점
   *
   * 계산 방식:
   *   기준 벡터: 골반 중심 → 수직 위 (골반 x, 골반 y-100)
   *   측정 벡터: 골반 중심 → 어깨 중심
   *   방향 보정: 어깨 중심이 골반 중심보다 왼쪽(회원 오른쪽)이면 양수
   *
   * 정상 기준: 35°
   */
  private checkSideBendingRight(
    sRightHip: Point,
    sLefttHip: Point,
    erRightShoulder: Point,
    erLeftShoulder: Point,
    erRightHip: Point,
    erLeftHip: Point,
  ) {
    if (!sRightHip || !sLefttHip || !erRightShoulder || !erLeftShoulder || !erRightHip || !erLeftHip) return null;

    const midHip = new Point(
      (erRightHip.x + erLeftHip.x) / 2,
      (erRightHip.y + erLeftHip.y) / 2,
    );
    const midShoulder = new Point(
      (erRightShoulder.x + erLeftShoulder.x) / 2,
      (erRightShoulder.y + erLeftShoulder.y) / 2,
    );
    const refPoint = new Point(midHip.x, midHip.y - 100); // 수직 상향 기준선

    let angle = calculateAngleBetweenVectors(midHip, refPoint, midHip, midShoulder);
    // 오른쪽 가쪽굽힘: 어깨 중심이 골반 중심보다 화면상 왼쪽(회원 오른쪽)이면 양수
    angle = midShoulder.x < midHip.x ? angle : 0;

    const normalAngle = 35;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.TORSO_LATERAL) ?? undefined;
    return {
      result: angle,
      score: Math.min(100, Math.max(0, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.TORSO_SIDE_BENDING_RIGHT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.TORSO_SIDE_BENDING_RIGHT,
      hypermobilityLevel,
    };
  }

  /**
   * 몸통 왼쪽 가쪽굽힘 (Left Trunk Lateral Flexion) 각도 계산
   *
   * 동일 개념: 어깨 중심이 골반 중심보다 오른쪽(회원 왼쪽)이면 양수
   * 정상 기준: 35°
   */
  private checkSideBendingLeft(
    sRightHip: Point,
    sLefttHip: Point,
    elRightShoulder: Point,
    elLeftShoulder: Point,
    elRightHip: Point,
    elLeftHip: Point,
  ) {
    if (!sRightHip || !sLefttHip || !elRightShoulder || !elLeftShoulder || !elRightHip || !elLeftHip) return null;

    const midHip = new Point(
      (elRightHip.x + elLeftHip.x) / 2,
      (elRightHip.y + elLeftHip.y) / 2,
    );
    const midShoulder = new Point(
      (elRightShoulder.x + elLeftShoulder.x) / 2,
      (elRightShoulder.y + elLeftShoulder.y) / 2,
    );
    const refPoint = new Point(midHip.x, midHip.y - 100); // 수직 상향 기준선

    let angle = calculateAngleBetweenVectors(midHip, refPoint, midHip, midShoulder);
    // 왼쪽 가쪽굽힘: 어깨 중심이 골반 중심보다 화면상 오른쪽(회원 왼쪽)이면 양수
    angle = midShoulder.x > midHip.x ? angle : 0;

    const normalAngle = 35;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.TORSO_LATERAL) ?? undefined;
    return {
      result: angle,
      score: Math.min(100, Math.max(0, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.TORSO_SIDE_BENDING_LEFT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.TORSO_SIDE_BENDING_LEFT,
      hypermobilityLevel,
    };
  }
  /**
   * 몸통 굽힘 (Trunk Flexion, 앞으로 숙이기) 각도 계산
   *
   * 사용 랜드마크 (우측면 촬영):
   *   eRightHip:      끝 자세 오른쪽 골반 → 기준 축
   *   eRightShoulder: 끝 자세 오른쪽 어깨 → 상체 방향 측정점
   *
   * 계산 방식:
   *   기준 벡터: 골반 → 수직 위 (골반 x, 골반 y-100)
   *   측정 벡터: 골반 → 어깨
   *   방향 보정: 우측면에서 어깨이 골반보다 앞(x 큼)이면 양수
   *
   * 정상 기준: 90°
   */
  private checkBending(sRightHip: Point, eRightHip: Point, eRightShoulder: Point) {
    if (!sRightHip || !eRightHip || !eRightShoulder) return null;

    // 우측면 촬영: axis=end골반, 기준=수직상향, target=어깨
    const refPoint = new Point(eRightHip.x, eRightHip.y - 100);
    let angle = calculateAngleBetweenVectors(eRightHip, refPoint, eRightHip, eRightShoulder);
    // 굽힘(앞으로): 우측면에서 어깨가 골반보다 오른쪽(x 클수록) → 양수
    angle = eRightShoulder.x > eRightHip.x ? angle : 0;

    const normalAngle = 90;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.TORSO_FLEX) ?? undefined;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.TORSO_BENDING_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.TORSO_BENDING,
      hypermobilityLevel,
    };
  }

  /**
   * 몸통 폄 (Trunk Extension, 뒤로 제치기) 각도 계산
   *
   * 사용 랜드마크 (좌측면 촬영):
   *   eRightHip:      끝 자세 오른쪽 골반 → 기준 축
   *   eRightShoulder: 끝 자세 오른쪽 어깨 → 측정점
   *
   * 계산 방식:
   *   기준 벡터: 골반 → 수직 위
   *   비고 보정: 좌측면에서 어깨이 골반보다 오른쪽(x 큼)이면 양수
   *
   * 정상 기준: 30°
   */
  private checkStraightening(sRightHip: Point, eRightHip: Point, eRightShoulder: Point) {
    if (!sRightHip || !eRightHip || !eRightShoulder) return null;

    // 좌측면 촬영: axis=end골반, 기준=수직상향, target=어깨
    const refPoint = new Point(eRightHip.x, eRightHip.y - 100);
    let angle = calculateAngleBetweenVectors(eRightHip, refPoint, eRightHip, eRightShoulder);
    // 폄(뒤로 젖히기): 좌측면 촬영에서 어깨가 골반보다 왼쪽(-x)이면 유효, 역방향(앞으로 굽힘)은 0 처리
    angle = eRightShoulder.x < eRightHip.x ? angle : 0;

    // 보정계수 1.15 적용 후 최대 30°로 제한
    angle = Math.min(angle * 1.15, 30);

    const normalAngle = 30;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.TORSO_STRAIGHTENING,
    };
  }

  /**
   * 몸통 오른쪽 회전 (25번) — 스펙 공식 + 보정계수
   *
   * 25/26 동일 산출식. 회전 후 자세(step2) 랜드마크만 사용.
   */
  private checkRotationRight(_frontLandmarks: any, rotatedLandmarks: any) {
    if (!rotatedLandmarks) return null;

    const rawTheta = measureTrunkRotationSpecDeg(rotatedLandmarks);
    if (rawTheta == null) return null;

    return buildTrunkRotationResponse(rawTheta, PRECISE_DISEASES.TORSO_ROTATION_RIGHT);
  }

  /**
   * 몸통 왼쪽 회전 (26번) — 스펙 공식 + 보정계수 (25번과 동일)
   */
  private checkRotationLeft(_frontLandmarks: any, rotatedLandmarks: any) {
    if (!rotatedLandmarks) return null;

    const rawTheta = measureTrunkRotationSpecDeg(rotatedLandmarks);
    if (rawTheta == null) return null;

    return buildTrunkRotationResponse(rawTheta, PRECISE_DISEASES.TORSO_ROTATION_LEFT);
  }
}
