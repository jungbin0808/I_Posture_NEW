import { PRECISE_DISEASES } from '../../../common/enums/precise-diseases.enum';
import { getResponse } from '../helpers/precise-response.helper';
import { calculateAngleBetweenVectors, calculateKneeAngle180Plus } from '../helpers/angle.helper';
import { Point } from '../helpers/point.helper';
import { AnalyticResult } from './analytic.result';
import { AnalyticStrategy } from './analytic.strategy';
import { DiseaseResult, Landmarks } from '../analysis.types';
import { getHypermobilityLevel, HYPER_STAGES } from '../helpers/hypermobility.helper';

/**
 * 무릅(Knee) ROM 측정 전략
 *
 * 측정 항목:
 *   - 굽힘(Flexion) 좌/우: 무릅을 굽히는 동작 → 정상 135°
 *   - 펼기(Extension) 좌/우: 무릅을 폼 동작 → 정상 180°
 *
 * 좌표계: 화면 픽셀 좌표 (x: 왼쪽→오른쪽, y: 위→아래)
 */
export class KneesStrategy implements AnalyticStrategy {
  async execute(landmarks: Landmarks): Promise<AnalyticResult> {
    const disease: DiseaseResult[] = [];
    const scoreDetail = {
      bendingRight: landmarks?.start_bend_right ? this.checkBendingRight(
        landmarks.start_bend_right.RightHip,
        landmarks.start_bend_right.RightKnee,
        landmarks.end_bend_right.RightKnee,
        landmarks.end_bend_right.RightAnkle,
      ) : null,
      bendingLeft: landmarks?.start_bend_left ? this.checkBendingLeft(
        landmarks.start_bend_left.LeftHip,
        landmarks.start_bend_left.LeftKnee,
        landmarks.end_bend_left.LeftKnee,
        landmarks.end_bend_left.LeftAnkle,
      ) : null,
      extendingRight: landmarks?.start_straighten_right ? this.checkExtendingRight(
        landmarks.start_straighten_right.RightHip,
        landmarks.start_straighten_right.RightKnee,
        landmarks.end_straighten_right.RightKnee,
        landmarks.end_straighten_right.RightAnkle,
      ) : null,
      extendingLeft: landmarks?.start_straighten_left ? this.checkExtendingLeft(
        landmarks.start_straighten_left.LeftHip,
        landmarks.start_straighten_left.LeftKnee,
        landmarks.end_straighten_left.LeftKnee,
        landmarks.end_straighten_left.LeftAnkle,
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
   * 오른쪽 무릅 굽힘 (Right Knee Flexion) 각도 계산
   *
   * 사용 랜드마크 (측면 촬영):
   *   sRightHip:   시작 자세 오른쪽 골반 → 허업지 각도 결정용
   *   eRightKnee:  끝 자세 오른쪽 무릅 → 기준 축
   *   eRightAnkle: 끝 자세 오른쪽 발목 → 아래다리 방향 측정점
   *
   * 계산 방식:
   *   기준선: 허복지(Hip→Knee) 얰장선 (Knee + (Knee-Hip) 방향)
   *   측정 벡터: 무릅 → 발목
   *   → 허복지 얰장선과 아래다리 개리 사이의 각도
   *   절대각 사용
   *
   * 정상 기준: 135°
   */
  private checkBendingRight(sRightHip: Point, sRightKnee: Point, eRightKnee: Point, eRightAnkle: Point) {
    if (!sRightHip || !eRightKnee || !eRightAnkle) return null;

    // 기준선: 허벅지(Hip→Knee) 연장선 (동적 기준)
    const refPoint = new Point(
      eRightKnee.x + (eRightKnee.x - sRightHip.x),
      eRightKnee.y + (eRightKnee.y - sRightHip.y),
    );
    const angle = calculateAngleBetweenVectors(eRightKnee, refPoint, eRightKnee, eRightAnkle);

    const normalAngle = 135;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.KNEE_FLEX) ?? undefined;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.KNEE_BENDING_RIGHT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.KNEE_BENDING_RIGHT,
      hypermobilityLevel,
    };
  }

  /**
   * 왼쪽 무릅 굽힘 (Left Knee Flexion) 각도 계산
   *
   * 동일 개념: 허복지 얰장선과 아래다리 사이 절대각
   * 정상 기준: 135°
   */
  private checkBendingLeft(sLeftHip: Point, sLeftKnee: Point, eLeftKnee: Point, eLeftAnkle: Point) {
    if (!sLeftHip || !eLeftKnee || !eLeftAnkle) return null;

    // 기준선: 허벅지(Hip→Knee) 연장선 (동적 기준)
    const refPoint = new Point(
      eLeftKnee.x + (eLeftKnee.x - sLeftHip.x),
      eLeftKnee.y + (eLeftKnee.y - sLeftHip.y),
    );
    const angle = calculateAngleBetweenVectors(eLeftKnee, refPoint, eLeftKnee, eLeftAnkle);

    const normalAngle = 135;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.KNEE_FLEX) ?? undefined;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.KNEE_BENDING_LEFT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.KNEE_BENDING_LEFT,
      hypermobilityLevel,
    };
  }
  /**
   * 오른쪽 무릅 펼기 (Right Knee Extension) 각도 계산
   *
   * 사용 랜드마크 (측면 촬영):
   *   sRightHip:   시작 자세 오른쪽 골반
   *   eRightKnee:  끝 자세 오른쪽 무릅 → 기준 축
   *   eRightAnkle: 끝 자세 오른쪽 발목 → 측정점
   *
   * 계산 방식:
   *   hip-knee-ankle 내각 기준. 거의 완전 폄(>=175°)일 때만 과신전 보정(>180°).
   *
   * 정상 기준: 180°
   */
  private checkExtendingRight(sRightHip: Point, sRightKnee: Point, eRightKnee: Point, eRightAnkle: Point) {
    if (!sRightHip || !eRightKnee || !eRightAnkle) return null;

    // 몸 앞쪽(굽힘면) 기준 방향성 보존 각도
    const angle = calculateKneeAngle180Plus(sRightHip, eRightKnee, eRightAnkle, false);

    const normalAngle = 180;
    const scoreAngle = Math.min(angle, normalAngle); // 과신전은 만점 처리
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.KNEE_EXT) ?? undefined;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (scoreAngle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.KNEE_EXTENDING_RIGHT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.KNEE_EXTENDING_RIGHT,
      hypermobilityLevel,
    };
  }

  /**
   * 왼쪽 무릅 펼기 (Left Knee Extension) 각도 계산
   *
   * 사용 랜드마크 (측면 촬영):
   *   sLeftHip:   시작 자세 왼쪽 골반
   *   eLeftKnee:  끝 자세 왼쪽 무릅 → 기준 축
   *   eLeftAnkle: 끝 자세 왼쪽 발목 → 측정점
   *
   * 계산 방식:
   *   hip-knee-ankle 내각 기준. 거의 완전 폄(>=175°)일 때만 과신전 보정(>180°).
   *
   * 정상 기준: 180°
   */
  private checkExtendingLeft(sLeftHip: Point, sLeftKnee: Point, eLeftKnee: Point, eLeftAnkle: Point) {
    if (!sLeftHip || !eLeftKnee || !eLeftAnkle) return null;

    // 몸 앞쪽(굽힘면) 기준 방향성 보존 각도
    const angle = calculateKneeAngle180Plus(sLeftHip, eLeftKnee, eLeftAnkle, true);

    const normalAngle = 180;
    const scoreAngle = Math.min(angle, normalAngle); // 과신전은 만점 처리
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.KNEE_EXT) ?? undefined;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (scoreAngle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.KNEE_EXTENDING_LEFT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.KNEE_EXTENDING_LEFT,
      hypermobilityLevel,
    };
  }

}
