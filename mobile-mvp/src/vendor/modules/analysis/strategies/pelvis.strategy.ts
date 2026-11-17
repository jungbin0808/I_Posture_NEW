import { PRECISE_DISEASES } from '../../../common/enums/precise-diseases.enum';
import { Point } from '../helpers/point.helper';
import { getResponse } from '../helpers/precise-response.helper';
import { calculateAngleBetweenVectors } from '../helpers/angle.helper';
import { AnalyticResult } from './analytic.result';
import { AnalyticStrategy } from './analytic.strategy';
import { DiseaseResult, Landmarks } from '../analysis.types';
import { getHypermobilityLevel, HYPER_STAGES } from '../helpers/hypermobility.helper';

/**
 * 엁관절(Hip) ROM 측정 전략
 *
 * 측정 항목:
 *   - 보외전(Abduction) 좌/우: 다리를 바깥으로 보내는 동작 → 정상 50°
 *   - 보안(Adduction) 좌/우: 다리를 안쪽으로 모으는 동작 → 정상 30°
 *   - 가쪽돌림(External Rotation) 좌/우: 대퍼를 바깥으로 돌리는 동작 → 정상 50°
 *   - 안쪽돌림(Internal Rotation) 좌/우: 대퍼를 안쪽으로 돌리는 동작 → 정상 40°
 *   - 굽힘(Flexion) 좌/우: 다리를 앞으로 들어 올리는 동작 → 정상 140°
 *   - 폴(Extension) 좌/우: 다리를 뒤로 들어 올리는 동작 → 정상 30°
 *
 * 좌표계: 화면 픽셀 좌표 (x: 왼쪽→오른쪽, y: 위→아래)
 */
export class PelvisStrategy implements AnalyticStrategy {
  async execute(landmarks: Landmarks): Promise<AnalyticResult> {
    const disease: DiseaseResult[] = [];
    const scoreDetail = {
      jointMovingRight: landmarks?.start_move_right ? this.checkJointMovingRight(
        landmarks.start_move_right.RightHip,
        landmarks.end_move_right.RightHip,
        landmarks.end_move_right.RightKnee,
      ) : null,
      jointMovingLeft: landmarks?.start_move_left ? this.checkJointMovingLeft(
        landmarks.start_move_left.LeftHip,
        landmarks.end_move_left.LeftHip,
        landmarks.end_move_left.LeftKnee,
      ) : null,
      jointMovingInwardRight: landmarks?.start_inward_right ? this.checkJointMovingInwardRight(
        landmarks.start_inward_right.RightHip,
        landmarks.end_inward_right.RightHip,
        landmarks.end_inward_right.RightKnee,
      ) : null,
      jointMovingInwardLeft: landmarks?.start_inward_left ? this.checkJointMovingInwardLeft(
        landmarks.start_inward_left.LeftHip,
        landmarks.end_inward_left.LeftHip,
        landmarks.end_inward_left.LeftKnee,
      ) : null,
      jointTurningOutwardRight: landmarks?.start_turn_out_right ? this.checkJointTurningOutwardRight(
        landmarks.start_turn_out_right.RightKnee,
        landmarks.end_turn_out_right.RightKnee,
        landmarks.end_turn_out_right.RightAnkle,
      ) : null,
      jointTurningOutwardLeft: landmarks?.start_turn_out_left ? this.checkJointTurningOutwardLeft(
        landmarks.start_turn_out_left.LeftKnee,
        landmarks.end_turn_out_left.LeftKnee,
        landmarks.end_turn_out_left.LeftAnkle,
      ) : null,
      jointTurningInwardRight: landmarks?.start_turn_in_right ? this.checkJointTurningInwardRight(
        landmarks.start_turn_in_right.RightKnee,
        landmarks.end_turn_in_right.RightKnee,
        landmarks.end_turn_in_right.RightAnkle,
      ) : null,
      jointTurningInwardLeft: landmarks?.start_turn_in_left ? this.checkJointTurningInwardLeft(
        landmarks.start_turn_in_left.LeftKnee,
        landmarks.end_turn_in_left.LeftKnee,
        landmarks.end_turn_in_left.LeftAnkle,
      ) : null,
      jointBendingRight: landmarks?.start_bend_right ? this.checkJointBendingRight(
        landmarks.start_bend_right.RightHip,
        landmarks.end_bend_right.RightHip,
        landmarks.end_bend_right.RightKnee,
      ) : null,
      jointBendingLeft: landmarks?.start_bend_left ? this.checkJointBendingLeft(
        landmarks.start_bend_left.LeftHip,
        landmarks.end_bend_left.LeftHip,
        landmarks.end_bend_left.LeftKnee,
      ) : null,
      jointStraighteningRight: landmarks?.start_straighten_right ? this.checkJointStraighteningRight(
        landmarks.start_straighten_right.RightHip,
        landmarks.end_straighten_right.RightHip,
        landmarks.end_straighten_right.RightKnee,
      ) : null,
      jointStraighteningLeft: landmarks?.start_straighten_left ? this.checkJointStraighteningLeft(
        landmarks.start_straighten_left.LeftHip,
        landmarks.end_straighten_left.LeftHip,
        landmarks.end_straighten_left.LeftKnee,
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
   * 오른쪽 엁관절 보외전 (Right Hip Abduction) 각도 계산
   *
   * 사용 랜드마크 (정면 촬영):
   *   eRightHip:  끝 자세 오른쪽 골반 → 기준 축
   *   eRightKnee: 끝 자세 오른쪽 무릅 → 다리 방향 측정점
   *
   * 계산 방식:
   *   기준 벡터: 골반 → 수직 아래
   *   측정 벡터: 골반 → 무릅
   *   방향 보정: 무릅이 골반보다 왼쪽(오른쪽 바깥으로)이면 양수
   *
   * 정상 기준: 50°
   */
  private checkJointMovingRight(sRightHip: Point, eRightHip: Point, eRightKnee: Point) {
    if (!eRightHip || !eRightKnee) return null;

    const refPoint = new Point(eRightHip.x, eRightHip.y + 100); // 수직 하향 기준선
    let angle = calculateAngleBetweenVectors(eRightHip, refPoint, eRightHip, eRightKnee);
    // 정면 촬영: 무릎이 골반보다 화면상 왼쪽(오른쪽 바깥) → 양수
    angle = eRightKnee.x < eRightHip.x ? angle : 0;

    const normalAngle = 50;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.HIP_LARGE) ?? undefined;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.HIP_JOINT_MOVING_RIGHT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.HIP_JOINT_MOVING_RIGHT,
      hypermobilityLevel,
    };
  }

  /**
   * 왼쪽 엁관절 보외전 (Left Hip Abduction) 각도 계산
   *
   * 사용 랜드마크 (정면 촬영):
   *   eLeftHip:  끝 자세 왼쪽 골반 → 기준 축
   *   eLeftKnee: 끝 자세 왼쪽 무릅 → 다리 방향 측정점
   *
   * 계산 방식:
   *   기준 벡터: 골반 → 수직 아래
   *   측정 벡터: 골반 → 무릅
   *   방향 보정: 무릅이 골반보다 오른쪽(왼쪽 바깥으로)이면 양수
   *
   * 정상 기준: 50°
   */
  private checkJointMovingLeft(sLeftHip: Point, eLeftHip: Point, eLeftKnee: Point) {
    if (!eLeftHip || !eLeftKnee) return null;

    const refPoint = new Point(eLeftHip.x, eLeftHip.y + 100); // 수직 하향 기준선
    let angle = calculateAngleBetweenVectors(eLeftHip, refPoint, eLeftHip, eLeftKnee);
    // 정면 촬영: 무릎이 골반보다 화면상 오른쪽(왼쪽 바깥) → 양수
    angle = eLeftKnee.x > eLeftHip.x ? angle : 0;

    const normalAngle = 50;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.HIP_LARGE) ?? undefined;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.HIP_JOINT_MOVING_LEFT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.HIP_JOINT_MOVING_LEFT,
      hypermobilityLevel,
    };
  }
  /**
   * 오른쪽 엁관절 보안 (Right Hip Adduction) 각도 계산
   *
   * 사용 랜드마크 (정면 촬영):
   *   eRightHip:  끝 자세 오른쪽 골반 → 기준 축
   *   eRightKnee: 끝 자세 오른쪽 무릅 → 측정점
   *
   * 계산 방식:
   *   기준 벡터: 골반 → 수직 아래
   *   측정 벡터: 골반 → 무릅
   *   방향 보정: 무릅이 골반보다 오른쪽(안쪽)이면 양수
   *
   * 정상 기준: 30°
   */
  private checkJointMovingInwardRight(sRightHip: Point, eRightHip: Point, eRightKnee: Point) {
    if (!eRightHip || !eRightKnee) return null;

    const refPoint = new Point(eRightHip.x, eRightHip.y + 100); // 수직 하향 기준선
    let angle = calculateAngleBetweenVectors(eRightHip, refPoint, eRightHip, eRightKnee);
    // 모음(안쪽): 무릎이 골반보다 화면상 오른쪽(안쪽) → 양수
    angle = eRightKnee.x > eRightHip.x ? angle : 0;

    const normalAngle = 30;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.HIP_ADD) ?? undefined;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.HIP_JOINT_MOVING_INWARD_RIGHT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.HIP_JOINT_MOVING_INWARD_RIGHT,
      hypermobilityLevel,
    };
  }

  /**
   * 왼쪽 엁관절 보안 (Left Hip Adduction) 각도 계산
   *
   * 사용 랜드마크 (정면 촬영):
   *   eLeftHip:  끝 자세 왼쪽 골반 → 기준 축
   *   eLeftKnee: 끝 자세 왼쪽 무릅 → 측정점
   *
   * 계산 방식:
   *   방향 보정: 무릅이 골반보다 왼쪽(안쪽)이면 양수
   *
   * 정상 기준: 30°
   */
  private checkJointMovingInwardLeft(sLeftHip: Point, eLeftHip: Point, eLeftKnee: Point) {
    if (!eLeftHip || !eLeftKnee) return null;

    const refPoint = new Point(eLeftHip.x, eLeftHip.y + 100); // 수직 하향 기준선
    let angle = calculateAngleBetweenVectors(eLeftHip, refPoint, eLeftHip, eLeftKnee);
    // 모음(안쪽): 무릎이 골반보다 화면상 왼쪽(안쪽) → 양수
    angle = eLeftKnee.x < eLeftHip.x ? angle : 0;

    const normalAngle = 30;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.HIP_ADD) ?? undefined;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.HIP_JOINT_MOVING_INWARD_LEFT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.HIP_JOINT_MOVING_INWARD_LEFT,
      hypermobilityLevel,
    };
  }

  /**
   * 오른쪽 엁관절 가쪽돌림 (Right Hip External Rotation) 각도 계산
   *
   * 사용 랜드마크 (누워서 가쪽돌림 자세):
   *   eRightKnee:  끝 자세 오른쪽 무릅 → 기준 축
   *   eRightAnkle: 끝 자세 오른쪽 발목 → 측정점
   *
   * 계산 방식:
   *   기준 벡터: 무릅 → 수직 아래
   *   측정 벡터: 무릅 → 발목
   *   방향 보정: 발목이 무릅보다 오른쪽(머 안쪽)이면 양수
   *
   * 정상 기준: 50°
   */
  private checkJointTurningOutwardRight(sRightKnee: Point, eRightKnee: Point, eRightAnkle: Point) {
    if (!eRightKnee || !eRightAnkle) return null;

    const refPoint = new Point(eRightKnee.x, eRightKnee.y + 100); // 수직 하향 기준선
    let angle = calculateAngleBetweenVectors(eRightKnee, refPoint, eRightKnee, eRightAnkle);
    // 가쪽돌림: 발목이 무릎보다 화면상 오른쪽(몸 안쪽) → 양수
    angle = eRightAnkle.x > eRightKnee.x ? angle : 0;

    const normalAngle = 50;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.HIP_LARGE) ?? undefined;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.HIP_JOINT_TURNING_OUTWARD_RIGHT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.HIP_JOINT_TURNING_OUTWARD_RIGHT,
      hypermobilityLevel,
    };
  }

  /**
   * 왼쪽 엁관절 가쪽돌림 (Left Hip External Rotation) 각도 계산
   *
   * 동일 개념, 방향만 반대 (발목이 무릅보다 왼쪽이면 양수)
   * 정상 기준: 50°
   */
  private checkJointTurningOutwardLeft(sLeftKnee: Point, eLeftKnee: Point, eLeftAnkle: Point) {
    if (!eLeftKnee || !eLeftAnkle) return null;

    const refPoint = new Point(eLeftKnee.x, eLeftKnee.y + 100); // 수직 하향 기준선
    let angle = calculateAngleBetweenVectors(eLeftKnee, refPoint, eLeftKnee, eLeftAnkle);
    // 가쪽돌림: 발목이 무릎보다 화면상 왼쪽(몸 안쪽) → 양수
    angle = eLeftAnkle.x < eLeftKnee.x ? angle : 0;

    const normalAngle = 50;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.HIP_LARGE) ?? undefined;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.HIP_JOINT_TURNING_OUTWARD_LEFT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.HIP_JOINT_TURNING_OUTWARD_LEFT,
      hypermobilityLevel,
    };
  }

  /**
   * 오른쪽 엁관절 안쪽돌림 (Right Hip Internal Rotation) 각도 계산
   *
   * 사용 랜드마크 (누워서 안쪽돌림 자세):
   *   eRightKnee:  끝 자세 오른쪽 무릅 → 기준 축
   *   eRightAnkle: 끝 자세 오른쪽 발목 → 측정점
   *
   * 계산 방식:
   *   방향 보정: 발목이 무릅보다 왼쪽(머 바깥쪽)이면 양수
   *
   * 정상 기준: 40°
   */
  private checkJointTurningInwardRight(sRightKnee: Point, eRightKnee: Point, eRightAnkle: Point) {
    if (!eRightKnee || !eRightAnkle) return null;

    const refPoint = new Point(eRightKnee.x, eRightKnee.y + 100); // 수직 하향 기준선
    let angle = calculateAngleBetweenVectors(eRightKnee, refPoint, eRightKnee, eRightAnkle);
    // 안쪽돌림: 발목이 무릎보다 화면상 왼쪽(몸 바깥쪽) → 양수
    angle = eRightAnkle.x < eRightKnee.x ? angle : 0;

    const normalAngle = 40;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.HIP_SMALL) ?? undefined;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.HIP_JOINT_TURNING_INWARD_RIGHT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.HIP_JOINT_TURNING_INWARD_RIGHT,
      hypermobilityLevel,
    };
  }

  /**
   * 왼쪽 엁관절 안쪽돌림 (Left Hip Internal Rotation) 각도 계산
   *
   * 동일 개념, 방향만 반대 (발목이 무릅보다 오른쪽이면 양수)
   * 정상 기준: 40°
   */
  private checkJointTurningInwardLeft(sLeftKnee: Point, eLeftKnee: Point, eLeftAnkle: Point) {
    if (!eLeftKnee || !eLeftAnkle) return null;

    const refPoint = new Point(eLeftKnee.x, eLeftKnee.y + 100); // 수직 하향 기준선
    let angle = calculateAngleBetweenVectors(eLeftKnee, refPoint, eLeftKnee, eLeftAnkle);
    // 안쪽돌림: 발목이 무릎보다 화면상 오른쪽(몸 바깥쪽) → 양수
    angle = eLeftAnkle.x > eLeftKnee.x ? angle : 0;

    const normalAngle = 40;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.HIP_SMALL) ?? undefined;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.HIP_JOINT_TURNING_INWARD_LEFT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.HIP_JOINT_TURNING_INWARD_LEFT,
      hypermobilityLevel,
    };
  }
  /**
   * 오른쪽 엁관절 굽힘 (Right Hip Flexion) 각도 계산
   *
   * 사용 랜드마크 (우측면 촬영):
   *   eRightHip:  끝 자세 오른쪽 골반 → 기준 축
   *   eRightKnee: 끝 자세 오른쪽 무릅 → 측정점
   *
   * 계산 방식:
   *   기준 벡터: 골반 → 수직 아래
   *   측정 벡터: 골반 → 무릅
   *   방향 보정: 우측면에서 무릅이 골반보다 앞(오른쪽, x 큼)이면 양수
   *
   * 정상 기준: 140°
   */
  private checkJointBendingRight(sRightHip: Point, eRightHip: Point, eRightKnee: Point) {
    if (!eRightHip || !eRightKnee) return null;

    const refPoint = new Point(eRightHip.x, eRightHip.y + 100); // 수직 하향 기준선
    let angle = calculateAngleBetweenVectors(eRightHip, refPoint, eRightHip, eRightKnee);
    // 우측면: 무릎이 골반보다 앞(화면상 오른쪽) → 양수
    angle = eRightKnee.x > eRightHip.x ? angle : 0;

    const normalAngle = 140;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.HIP_FLEX_EXT) ?? undefined;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.HIP_JOINT_BENDING_RIGHT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.HIP_JOINT_BENDING_RIGHT,
      hypermobilityLevel,
    };
  }

  /**
   * 왼쪽 엁관절 굽힘 (Left Hip Flexion) 각도 계산
   *
   * 동일 개념, 방향만 반대 (좌측면에서 무릅이 골반보다 왼쪽, x 작으면 양수)
   * 정상 기준: 140°
   */
  private checkJointBendingLeft(sLeftHip: Point, eLeftHip: Point, eLeftKnee: Point) {
    if (!eLeftHip || !eLeftKnee) return null;

    const refPoint = new Point(eLeftHip.x, eLeftHip.y + 100); // 수직 하향 기준선
    let angle = calculateAngleBetweenVectors(eLeftHip, refPoint, eLeftHip, eLeftKnee);
    // 좌측면: 무릎이 골반보다 앞(화면상 왼쪽) → 양수
    angle = eLeftKnee.x < eLeftHip.x ? angle : 0;

    const normalAngle = 140;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.HIP_FLEX_EXT) ?? undefined;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.HIP_JOINT_BENDING_LEFT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.HIP_JOINT_BENDING_LEFT,
      hypermobilityLevel,
    };
  }
  /**
   * 오른쪽 엁관절 폴 (Right Hip Extension) 각도 계산
   *
   * 사용 랜드마크 (우측면 촬영):
   *   eRightHip:  끝 자세 오른쪽 골반 → 기준 축
   *   eRightKnee: 끝 자세 오른쪽 무릅 → 측정점
   *
   * 계산 방식:
   *   방향 보정: 우측면에서 무릅이 골반보다 뒤(왼쪽, x 작)이면 양수
   *
   * 정상 기준: 30°
   */
  private checkJointStraighteningRight(sRightHip: Point, eRightHip: Point, eRightKnee: Point) {
    if (!eRightHip || !eRightKnee) return null;

    const refPoint = new Point(eRightHip.x, eRightHip.y + 100); // 수직 하향 기준선
    let angle = calculateAngleBetweenVectors(eRightHip, refPoint, eRightHip, eRightKnee);
    // 우측면: 무릎이 골반보다 뒤(화면상 왼쪽) → 양수
    angle = eRightKnee.x < eRightHip.x ? angle : 0;

    const normalAngle = 30;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.HIP_FLEX_EXT) ?? undefined;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.HIP_JOINT_STRAIGHTENING_RIGHT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.HIP_JOINT_STRAIGHTENING_RIGHT,
      hypermobilityLevel,
    };
  }

  /**
   * 왼쪽 엁관절 폴 (Left Hip Extension) 각도 계산
   *
   * 동일 개념, 방향만 반대 (좌측면에서 무릅이 골반보다 오른쪽, x 큼면 양수)
   * 정상 기준: 30°
   */
  private checkJointStraighteningLeft(sLeftHip: Point, eLeftHip: Point, eLeftKnee: Point) {
    if (!eLeftHip || !eLeftKnee) return null;

    const refPoint = new Point(eLeftHip.x, eLeftHip.y + 100); // 수직 하향 기준선
    let angle = calculateAngleBetweenVectors(eLeftHip, refPoint, eLeftHip, eLeftKnee);
    // 좌측면: 무릎이 골반보다 뒤(화면상 오른쪽) → 양수
    angle = eLeftKnee.x > eLeftHip.x ? angle : 0;

    const normalAngle = 30;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.HIP_FLEX_EXT) ?? undefined;
    return {
      result: angle,
      score: Math.max(0, Math.min(100, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.HIP_JOINT_STRAIGHTENING_LEFT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.HIP_JOINT_STRAIGHTENING_LEFT,
      hypermobilityLevel,
    };
  }
}
