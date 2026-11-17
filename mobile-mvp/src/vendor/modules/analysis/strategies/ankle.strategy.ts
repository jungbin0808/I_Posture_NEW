import { PRECISE_DISEASES } from '../../../common/enums/precise-diseases.enum';
import { Point } from '../helpers/point.helper';
import { getResponse } from '../helpers/precise-response.helper';
import { calculateAngleBetweenVectors, calculateAnkleFlexionAngle } from '../helpers/angle.helper';
import { AnalyticResult } from './analytic.result';
import { AnalyticStrategy } from './analytic.strategy';
import { DiseaseResult, Landmarks } from '../analysis.types';

/**
 * 발목(Ankle) ROM 측정 전략
 *
 * 측정 항목:
 *   - 안쪽번짐 좌/우 (Inversion): 발을 안쪽으로 기울이는 동작 → 정상 35°
 *   - 가쪽번짐 좌/우 (Eversion): 발을 바깥쪽으로 기울이는 동작 → 정상 15°
 *   - 발바닥굽힘 좌/우 (Plantarflexion): 시작선에서 발끝쪽 → 정상 50°
 *   - 발등굽힘 좌/우 (Dorsiflexion): 시작선에서 몸쪽(무릎 방향) → 정상 20°
 *
 * DF/PF 시작선(0°): 발목-무릎 선에 수직인 선 (꼭짓점: 발목, 검은 기준선)
 * 측정선: 발목 → foot index
 *
 * 좌표계: 화면 픽셀 좌표 (x: 왼쪽→오른쪽, y: 위→아래)
 */
export class AnkleStrategy implements AnalyticStrategy {
  async execute(landmarks: Landmarks): Promise<AnalyticResult> {
    const disease: DiseaseResult[] = [];
    const scoreDetail = {
      inwardCollapseRight: landmarks?.start_inward_right ? this.checkInwardRight(
        landmarks.start_inward_right.RightAnkle,
        landmarks.end_inward_right.RightAnkle,
        landmarks.end_inward_right.RightFootIndex || landmarks.end_inward_right.RightToe,
      ) : null,
      inwardCollapseLeft: landmarks?.start_inward_left ? this.checkInwardLeft(
        landmarks.start_inward_left.LeftAnkle,
        landmarks.end_inward_left.LeftAnkle,
        landmarks.end_inward_left.LeftFootIndex || landmarks.end_inward_left.LeftToe,
      ) : null,
      outwardCollapseRight: landmarks?.start_outward_right ? this.checkOutwardRight(
        landmarks.start_outward_right.RightAnkle,
        landmarks.end_outward_right.RightAnkle,
        landmarks.end_outward_right.RightFootIndex || landmarks.end_outward_right.RightToe,
      ) : null,
      outwardCollapseLeft: landmarks?.start_outward_left ? this.checkOutwardLeft(
        landmarks.start_outward_left.LeftAnkle,
        landmarks.end_outward_left.LeftAnkle,
        landmarks.end_outward_left.LeftFootIndex || landmarks.end_outward_left.LeftToe,
      ) : null,
      extentionRight: landmarks?.end_extension_right ? this.checkExtentionRight(
        landmarks.end_extension_right.RightKnee,
        landmarks.end_extension_right.RightAnkle,
        landmarks.end_extension_right.RightFootIndex || landmarks.end_extension_right.RightToe,
      ) : null,
      extentionLeft: landmarks?.end_extension_left ? this.checkExtentionLeft(
        landmarks.end_extension_left.LeftKnee,
        landmarks.end_extension_left.LeftAnkle,
        landmarks.end_extension_left.LeftFootIndex || landmarks.end_extension_left.LeftToe,
      ) : null,
      bendingRight: landmarks?.end_bend_right ? this.checkBendingRight(
        landmarks.end_bend_right.RightKnee,
        landmarks.end_bend_right.RightAnkle,
        landmarks.end_bend_right.RightFootIndex || landmarks.end_bend_right.RightToe,
      ) : null,
      bendingLeft: landmarks?.end_bend_left ? this.checkBendingLeft(
        landmarks.end_bend_left.LeftKnee,
        landmarks.end_bend_left.LeftAnkle,
        landmarks.end_bend_left.LeftFootIndex || landmarks.end_bend_left.LeftToe,
      ) : null,
    };

    Object.values(scoreDetail).forEach(detail => {
      if (detail && detail.disease !== 'NORMAL') {
        disease.push({
          key: detail.disease,
          level: '',
          score: 0,
        });
      }
    });

    return new AnalyticResult(0, scoreDetail, disease);
  }

  /**
   * 오른쪽 발목 안쪽번짐 (Right Ankle Inversion) 각도 계산
   *
   * 사용 랜드마크 (정면 촬영):
   *   eRightAnkle: 끝 자세 오른쪽 발목 → 기준 축
   *   eRightFoot:  끝 자세 오른쪽 발끝(FootIndex) → 측정점
   *
   * 계산 방식:
   *   기준 벡터: 발목 → 수직 아래 (발목 x, 발목 y+100)
   *   측정 벡터: 발목 → 발끝
   *   방향 보정: 발끝이 발목보다 오른쪽(안쪽 방향)이면 양수
   *
   * 정상 기준: 35°
   */
  private checkInwardRight(sRightAnkle: Point, eRightAnkle: Point, eRightFoot: Point) {
    if (!eRightAnkle || !eRightFoot) return null;

    const refPoint = new Point(eRightAnkle.x, eRightAnkle.y + 100); // 수직 하향 기준선
    let angle = calculateAngleBetweenVectors(eRightAnkle, refPoint, eRightAnkle, eRightFoot);
    // 안쪽번짐: 발이 발목보다 화면상 오른쪽(몸 안쪽) → 양수, 반대방향 0
    angle = eRightFoot.x > eRightAnkle.x ? angle : 0;

    const normalAngle = 35;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.ANKLE_INWARD_COLLAPSE_RIGHT,
    };
  }

  /**
   * 왼쪽 발목 안쪽번짐 (Left Ankle Inversion) 각도 계산
   *
   * 사용 랜드마크 (정면 촬영):
   *   eLeftAnkle: 끝 자세 왼쪽 발목 → 기준 축
   *   eLeftFoot:  끝 자세 왼쪽 발끝(FootIndex) → 측정점
   *
   * 계산 방식:
   *   기준 벡터: 발목 → 수직 아래 (발목 x, 발목 y+100)
   *   측정 벡터: 발목 → 발끝
   *   방향 보정: 발끝이 발목보다 왼쪽(안쪽 방향)이면 양수
   *
   * 정상 기준: 35°
   */
  private checkInwardLeft(sLeftAnkle: Point, eLeftAnkle: Point, eLeftFoot: Point) {
    if (!eLeftAnkle || !eLeftFoot) return null;

    const refPoint = new Point(eLeftAnkle.x, eLeftAnkle.y + 100); // 수직 하향 기준선
    let angle = calculateAngleBetweenVectors(eLeftAnkle, refPoint, eLeftAnkle, eLeftFoot);
    // 안쪽번짐: 발이 발목보다 화면상 왼쪽(몸 안쪽) → 양수, 반대방향 0
    angle = eLeftFoot.x < eLeftAnkle.x ? angle : 0;

    const normalAngle = 35;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.ANKLE_INWARD_COLLAPSE_LEFT,
    };
  }
  /**
   * 오른쪽 발목 가쪽번짐 (Right Ankle Eversion) 각도 계산
   *
   * 사용 랜드마크 (정면 촬영):
   *   eRightAnkle: 끝 자세 오른쪽 발목 → 기준 축
   *   eRightFoot:  끝 자세 오른쪽 발끝 → 측정점
   *
   * 계산 방식:
   *   기준 벡터: 발목 → 수직 아래
   *   측정 벡터: 발목 → 발끝
   *   방향 보정: 발끝이 발목보다 왼쪽(바깥 방향)이면 양수
   *
   * 정상 기준: 15°
   */
  private checkOutwardRight(sRightAnkle: Point, eRightAnkle: Point, eRightFoot: Point) {
    if (!eRightAnkle || !eRightFoot) return null;

    const refPoint = new Point(eRightAnkle.x, eRightAnkle.y + 100); // 수직 하향 기준선
    let angle = calculateAngleBetweenVectors(eRightAnkle, refPoint, eRightAnkle, eRightFoot);
    // 가쪽번짐: 발이 발목보다 화면상 왼쪽(몸 바깥쪽) → 양수, 반대방향 0
    angle = eRightFoot.x < eRightAnkle.x ? angle : 0;

    const normalAngle = 15;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.ANKLE_OUTWARD_COLLAPSE_RIGHT,
    };
  }

  /**
   * 왼쪽 발목 가쪽번짐 (Left Ankle Eversion) 각도 계산
   *
   * 사용 랜드마크 (정면 촬영):
   *   eLeftAnkle: 끝 자세 왼쪽 발목 → 기준 축
   *   eLeftFoot:  끝 자세 왼쪽 발끝 → 측정점
   *
   * 계산 방식:
   *   기준 벡터: 발목 → 수직 아래
   *   측정 벡터: 발목 → 발끝
   *   방향 보정: 발끝이 발목보다 오른쪽(바깥 방향)이면 양수
   *
   * 정상 기준: 15°
   */
  private checkOutwardLeft(sLeftAnkle: Point, eLeftAnkle: Point, eLeftFoot: Point) {
    if (!eLeftAnkle || !eLeftFoot) return null;

    const refPoint = new Point(eLeftAnkle.x, eLeftAnkle.y + 100); // 수직 하향 기준선
    let angle = calculateAngleBetweenVectors(eLeftAnkle, refPoint, eLeftAnkle, eLeftFoot);
    // 가쪽번짐: 발이 발목보다 화면상 오른쪽(몸 바깥쪽) → 양수, 반대방향 0
    angle = eLeftFoot.x > eLeftAnkle.x ? angle : 0;

    const normalAngle = 15;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.ANKLE_OUTWARD_COLLAPSE_LEFT,
    };
  }
  /**
   * 오른쪽 발목 발바닥굽힘 (Right Ankle Plantarflexion) 각도 계산
   *
   * 사용 랜드마크 (측면 촬영):
   *   eRightKnee:  끝 자세 오른쪽 무릎
   *   eRightAnkle: 끝 자세 오른쪽 발목 → 꼭짓점
   *   eRightFoot:  끝 자세 오른쪽 발끝(FootIndex) → 측정점
   *
   * 계산 방식:
   *   시작선(0°): Rt ankle-Rt knee 선에 수직인 선
   *   측정선: Rt ankle → Rt foot index
   *   방향: 시작선에서 발끝쪽 각도
   *
   * 정상 기준: 50°
   */
  private checkExtentionRight(eRightKnee: Point, eRightAnkle: Point, eRightFoot: Point) {
    if (!eRightAnkle || !eRightFoot || !eRightKnee) return null;

    const angle = calculateAnkleFlexionAngle(
      eRightAnkle,
      eRightKnee,
      eRightFoot,
      'plantarflexion',
    );

    const normalAngle = 50;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.ANKLE_EXTENTION_RIGHT,
    };
  }

  /**
   * 왼쪽 발목 발바닥굽힘 (Left Ankle Plantarflexion) 각도 계산
   *
   * 사용 랜드마크 (측면 촬영):
   *   eLeftKnee:  끝 자세 왼쪽 무릎
   *   eLeftAnkle: 끝 자세 왼쪽 발목 → 꼭짓점
   *   eLeftFoot:  끝 자세 왼쪽 발끝(FootIndex) → 측정점
   *
   * 계산 방식:
   *   시작선(0°): Lt ankle-Lt knee 선에 수직인 선
   *   측정선: Lt ankle → Lt foot index
   *   방향: 시작선에서 발끝쪽 각도
   *
   * 정상 기준: 50°
   */
  private checkExtentionLeft(eLeftKnee: Point, eLeftAnkle: Point, eLeftFoot: Point) {
    if (!eLeftAnkle || !eLeftFoot || !eLeftKnee) return null;

    const angle = calculateAnkleFlexionAngle(
      eLeftAnkle,
      eLeftKnee,
      eLeftFoot,
      'plantarflexion',
    );

    const normalAngle = 50;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.ANKLE_EXTENTION_LEFT,
    };
  }
  /**
   * 오른쪽 발목 발등굽힘 (Right Ankle Dorsiflexion) 각도 계산
   *
   * 사용 랜드마크 (측면 촬영):
   *   eRightKnee:  끝 자세 오른쪽 무릎
   *   eRightAnkle: 끝 자세 오른쪽 발목 → 꼭짓점
   *   eRightFoot:  끝 자세 오른쪽 발끝(FootIndex) → 측정점
   *
   * 계산 방식:
   *   시작선(0°): Rt ankle-Rt knee 선에 수직인 선
   *   측정선: Rt ankle → Rt foot index
   *   방향: 시작선에서 몸쪽(무릎 방향) 각도
   *
   * 정상 기준: 20°
   */
  private checkBendingRight(eRightKnee: Point, eRightAnkle: Point, eRightFoot: Point) {
    if (!eRightAnkle || !eRightFoot || !eRightKnee) return null;

    const angle = calculateAnkleFlexionAngle(
      eRightAnkle,
      eRightKnee,
      eRightFoot,
      'dorsiflexion',
    );

    const normalAngle = 20;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.ANKLE_BENDING_RIGHT,
    };
  }

  /**
   * 왼쪽 발목 발등굽힘 (Left Ankle Dorsiflexion) 각도 계산
   *
   * 사용 랜드마크 (측면 촬영):
   *   eLeftKnee:  끝 자세 왼쪽 무릎
   *   eLeftAnkle: 끝 자세 왼쪽 발목 → 꼭짓점
   *   eLeftFoot:  끝 자세 왼쪽 발끝(FootIndex) → 측정점
   *
   * 계산 방식:
   *   시작선(0°): Lt ankle-Lt knee 선에 수직인 선
   *   측정선: Lt ankle → Lt foot index
   *   방향: 시작선에서 몸쪽(무릎 방향) 각도
   *
   * 정상 기준: 20°
   */
  private checkBendingLeft(eLeftKnee: Point, eLeftAnkle: Point, eLeftFoot: Point) {
    if (!eLeftAnkle || !eLeftFoot || !eLeftKnee) return null;

    const angle = calculateAnkleFlexionAngle(
      eLeftAnkle,
      eLeftKnee,
      eLeftFoot,
      'dorsiflexion',
    );

    const normalAngle = 20;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.ANKLE_BENDING_LEFT,
    };
  }
}
