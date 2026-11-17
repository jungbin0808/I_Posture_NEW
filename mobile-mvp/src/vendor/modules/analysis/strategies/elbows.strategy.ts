import { PRECISE_DISEASES } from '../../../common/enums/precise-diseases.enum';
import { getResponse } from '../helpers/precise-response.helper';
import { calculateAngleBetweenVectors, calculateKneeAngle180Plus } from '../helpers/angle.helper';
import { Point } from '../helpers/point.helper';
import { AnalyticResult } from './analytic.result';
import { AnalyticStrategy } from './analytic.strategy';
import { DiseaseResult, Landmarks } from '../analysis.types';
import { getHypermobilityLevel, HYPER_STAGES } from '../helpers/hypermobility.helper';

/**
 * 팔꿈치(Elbow) ROM 측정 전략
 *
 * 측정 항목:
 *   - 굽힘(Flexion) 좌/우: 팔꿈치를 굽히는 동작 → 정상 150°
 *   - 폄(Extension) 좌/우: 팔꿈치를 펴는 동작 → 정상 180°
 *
 * 좌표계: 화면 픽셀 좌표 (x: 왼쪽→오른쪽, y: 위→아래)
 */
export class ElbowsStrategy implements AnalyticStrategy {
  async execute(landmarks: Landmarks): Promise<AnalyticResult> {
    const disease: DiseaseResult[] = [];
    const scoreDetail = {
      jointBendingRight: landmarks?.end_bend_right ? this.checkBendingRight(
        landmarks.end_bend_right.RightShoulder,
        landmarks.end_bend_right.RightElbow,
        landmarks.end_bend_right.RightWrist,
      ) : null,
      jointBendingLeft: landmarks?.end_bend_left ? this.checkBendingLeft(
        landmarks.end_bend_left.LeftShoulder,
        landmarks.end_bend_left.LeftElbow,
        landmarks.end_bend_left.LeftWrist,
      ) : null,
      jointStraighteningRight: landmarks?.end_straighten_right ? this.checkStraighteningRight(
        landmarks.end_straighten_right.RightShoulder,
        landmarks.end_straighten_right.RightElbow,
        landmarks.end_straighten_right.RightWrist,
      ) : null,
      jointStraighteningLeft: landmarks?.end_straighten_left ? this.checkStraighteningLeft(
        landmarks.end_straighten_left.LeftShoulder,
        landmarks.end_straighten_left.LeftElbow,
        landmarks.end_straighten_left.LeftWrist,
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
   * 오른쪽 팔꿈치 굽힘 (Right Elbow Flexion) 각도 계산
   *
   * 사용 랜드마크 (측면 촬영):
   *   eRightShoulder: 끝 자세 오른쪽 어깨 → 기준 방향 결정용
   *   eRightElbow:    끝 자세 오른쪽 팔꿈치 → 기준 축
   *   eRightWrist:    끝 자세 오른쪽 손목 → 측정점
   *
   * 계산 방식:
   *   기준선: 위팔 얰장선 (Elbow + (Elbow-Shoulder) 방향)
   *   측정 벡터: 팔꿈치 → 손목
   *   → 위팔 얰장선과 아래팔 연결선 사이의 각도
   *   절대각 사용 (어느 쪽이든 양수)
   *
   * 정상 기준: 150°
   */
  private checkBendingRight(eRightShoulder: Point, eRightElbow: Point, eRightWrist: Point) {
    if (!eRightShoulder || !eRightElbow || !eRightWrist) return null;

    // 기준선: 위팔(Shoulder→Elbow) 연장선 (동적 기준)
    const refPoint = new Point(
      eRightElbow.x + (eRightElbow.x - eRightShoulder.x),
      eRightElbow.y + (eRightElbow.y - eRightShoulder.y),
    );
    const angle = calculateAngleBetweenVectors(eRightElbow, refPoint, eRightElbow, eRightWrist);

    const normalAngle = 150;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.ELBOW) ?? undefined;
    return {
      result: angle,
      score: Math.min(100, Math.max(0, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.ELBOW_BENDING_RIGHT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.ELBOW_BENDING_RIGHT,
      hypermobilityLevel,
    };
  }

  /**
   * 왼쪽 팔꿈치 굽힘 (Left Elbow Flexion) 각도 계산
   *
   * 사용 랜드마크 (측면 촬영):
   *   eLeftShoulder: 끝 자세 왼쪽 어깨
   *   eLeftElbow:    끝 자세 왼쪽 팔꿈치 → 기준 축
   *   eLeftWrist:    끝 자세 왼쪽 손목 → 측정점
   *
   * 계산 방식:
   *   기준선: 위팔 얰장선
   *   절대각 사용
   *
   * 정상 기준: 150°
   */
  private checkBendingLeft(eLeftShoulder: Point, eLeftElbow: Point, eLeftWrist: Point) {
    if (!eLeftShoulder || !eLeftElbow || !eLeftWrist) return null;

    // 기준선: 위팔(Shoulder→Elbow) 연장선 (동적 기준)
    const refPoint = new Point(
      eLeftElbow.x + (eLeftElbow.x - eLeftShoulder.x),
      eLeftElbow.y + (eLeftElbow.y - eLeftShoulder.y),
    );
    const angle = calculateAngleBetweenVectors(eLeftElbow, refPoint, eLeftElbow, eLeftWrist);

    const normalAngle = 150;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.ELBOW) ?? undefined;
    return {
      result: angle,
      score: Math.min(100, Math.max(0, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.ELBOW_BENDING_LEFT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.ELBOW_BENDING_LEFT,
      hypermobilityLevel,
    };
  }

  /**
   * 오른쪽 팔꿈치 폄 (Right Elbow Extension) 각도 계산
   *
   * 사용 랜드마크 (측면 촬영):
   *   eRightShoulder: 끝 자세 오른쪽 어깨
   *   eRightElbow:    끝 자세 오른쪽 팔꿈치 → 기준 축
   *   eRightWrist:    끝 자세 오른쪽 손목 → 측정점
   *
   * 계산 방식:
   *   shoulder-elbow-wrist 내각 기준. 거의 완전 폄(>=175°)일 때만 과신전 보정(>180°).
   *
   * 정상 기준: 180° (과신전 시 만점 처리)
   */
  private checkStraighteningRight(eRightShoulder: Point, eRightElbow: Point, eRightWrist: Point) {
    if (!eRightShoulder || !eRightElbow || !eRightWrist) return null;

    // 몸 앞쪽(굽힘면) 기준 방향성 보존 각도
    const angle = calculateKneeAngle180Plus(eRightShoulder, eRightElbow, eRightWrist, false);

    const normalAngle = 180;
    const scoreAngle = Math.min(angle, normalAngle); // 과신전은 만점 처리
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.ELBOW) ?? undefined;
    return {
      result: angle,
      score: Math.min(100, Math.max(0, (scoreAngle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.ELBOW_STRAIGHTENING_RIGHT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.ELBOW_STRAIGHTENING_RIGHT,
      hypermobilityLevel,
    };
  }

  /**
   * 왼쪽 팔꿈치 폄 (Left Elbow Extension) 각도 계산
   *
   * 사용 랜드마크 (측면 촬영):
   *   eLeftShoulder: 끝 자세 왼쪽 어깨
   *   eLeftElbow:    끝 자세 왼쪽 팔꿈치 → 기준 축
   *   eLeftWrist:    끝 자세 왼쪽 손목 → 측정점
   *
   * 계산 방식:
   *   shoulder-elbow-wrist 내각 기준. 거의 완전 폄(>=175°)일 때만 과신전 보정(>180°).
   *
   * 정상 기준: 180° (과신전 시 만점 처리)
   */
  private checkStraighteningLeft(eLeftShoulder: Point, eLeftElbow: Point, eLeftWrist: Point) {
    if (!eLeftShoulder || !eLeftElbow || !eLeftWrist) return null;

    // 몸 앞쪽(굽힘면) 기준 방향성 보존 각도
    const angle = calculateKneeAngle180Plus(eLeftShoulder, eLeftElbow, eLeftWrist, true);

    const normalAngle = 180;
    const scoreAngle = Math.min(angle, normalAngle); // 과신전은 만점 처리
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.ELBOW) ?? undefined;
    return {
      result: angle,
      score: Math.min(100, Math.max(0, (scoreAngle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.ELBOW_STRAIGHTENING_LEFT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.ELBOW_STRAIGHTENING_LEFT,
      hypermobilityLevel,
    };
  }

}
