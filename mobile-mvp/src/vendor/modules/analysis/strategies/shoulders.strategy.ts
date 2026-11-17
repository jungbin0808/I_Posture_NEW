import { PRECISE_DISEASES } from '../../../common/enums/precise-diseases.enum';
import { Point } from '../helpers/point.helper';
import { getResponse } from '../helpers/precise-response.helper';
import { calculateAngleBetweenVectors } from '../helpers/angle.helper';
import { AnalyticResult } from './analytic.result';
import { AnalyticStrategy } from './analytic.strategy';
import { DiseaseResult, Landmarks } from '../analysis.types';
import { getHypermobilityLevel, HYPER_STAGES } from '../helpers/hypermobility.helper';

/**
 * 어깨(Shoulder) ROM 측정 전략
 *
 * 측정 항목:
 *   - 보외전(Abduction) 좌/우: 팔을 옆으로 들어 올리는 동작 → 정상 180°
 *   - 보안(Adduction) 좌/우: 팔을 안쪽으로 모으는 동작 → 정상 45°
 *   - 굽힘(Flexion) 좌/우: 팔을 앞으로 들어 올리는 동작 → 정상 180°
 *   - 폴(Extension) 좌/우: 팔을 뒤로 들어 올리는 동작 → 정상 50°
 *   - 안쪽돌림(Internal Rotation) 좌/우: 팔쿈치를 90° 굵힌 상태에서 손목을 아래로 → 정상 70°
 *   - 바깥쪽돌림(External Rotation) 좌/우: 팔쿈치를 90° 굽힌 상태에서 손목을 위로 → 정상 90°
 *
 * 좌표계: 화면 픽셀 좌표 (x: 왼쪽→오른쪽, y: 위→아래)
 */
export class ShouldersStrategy implements AnalyticStrategy {

  async execute(landmarks: Landmarks): Promise<AnalyticResult> {
    const disease: DiseaseResult[] = [];
    const scoreDetail = {
      jointMovingRight: landmarks?.start_right_arm_up ? this.checkJointMovingRight(
        landmarks.start_right_arm_up.RightShoulder,
        landmarks.end_right_arm_up.RightShoulder,
        landmarks.end_right_arm_up.RightElbow,
      ) : null,
      jointMovingLeft: landmarks?.start_left_arm_up ? this.checkJointMovingLeft(
        landmarks.start_left_arm_up.LeftShoulder,
        landmarks.end_left_arm_up.LeftShoulder,
        landmarks.end_left_arm_up.LeftElbow,
      ) : null,
      // 모음 (Adduction) 추가
      jointAdductionRight: landmarks?.start_adduction_right ? this.checkJointAdductionRight(
        landmarks.start_adduction_right.RightShoulder,
        landmarks.end_adduction_right.RightShoulder,
        landmarks.end_adduction_right.RightElbow,
      ) : null,
      jointAdductionLeft: landmarks?.start_adduction_left ? this.checkJointAdductionLeft(
        landmarks.start_adduction_left.LeftShoulder,
        landmarks.end_adduction_left.LeftShoulder,
        landmarks.end_adduction_left.LeftElbow,
      ) : null,
      jointBendingRight: landmarks?.start_bend_right ? this.checkJointBendingRight(
        landmarks.end_bend_right.RightShoulder,
        landmarks.end_bend_right.RightElbow,
      ) : null,
      jointBendingLeft: landmarks?.start_bend_left ? this.checkJointBendingLeft(
        landmarks.end_bend_left.LeftShoulder,
        landmarks.end_bend_left.LeftElbow,
      ) : null,
      jointStraighteningRight: landmarks?.start_straighten_right ? this.checkJointStraighteningRight(
        landmarks.end_straighten_right.RightShoulder,
        landmarks.end_straighten_right.RightElbow,
      ) : null,
      jointStraighteningLeft: landmarks?.start_straighten_left ? this.checkJointStraighteningLeft(
        landmarks.end_straighten_left.LeftShoulder,
        landmarks.end_straighten_left.LeftElbow,
      ) : null,
      jointTurningInRight: landmarks?.start_turn_in_right ? this.checkJointTurningInRight(
        landmarks.start_turn_in_right.RightWrist,
        landmarks.start_turn_in_right.RightElbow,
        landmarks.end_turn_in_right.RightWrist,
        landmarks.end_turn_in_right.RightElbow,
      ) : null,
      jointTurningInLeft: landmarks?.start_turn_in_left ? this.checkJointTurningInLeft(
        landmarks.start_turn_in_left.LeftWrist,
        landmarks.start_turn_in_left.LeftElbow,
        landmarks.end_turn_in_left.LeftWrist,
        landmarks.end_turn_in_left.LeftElbow,
      ) : null,
      jointTurningOutRight: landmarks?.start_turn_out_right ? this.checkJointTurningOutRight(
        landmarks.start_turn_out_right.RightWrist,
        landmarks.start_turn_out_right.RightElbow,
        landmarks.end_turn_out_right.RightWrist,
        landmarks.end_turn_out_right.RightElbow,
      ) : null,
      jointTurningOutLeft: landmarks?.start_turn_out_left ? this.checkJointTurningOutLeft(
        landmarks.start_turn_out_left.LeftWrist,
        landmarks.start_turn_out_left.LeftElbow,
        landmarks.end_turn_out_left.LeftWrist,
        landmarks.end_turn_out_left.LeftElbow,
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
   * 오른쪽 어깨 보외전 (Right Shoulder Abduction) 각도 계산
   *
   * 사용 랜드마크 (정면 촬영):
   *   eRightShoulder: 끝 자세 오른쪽 어깨 → 기준 축
   *   eRightElbow:    끝 자세 오른쪽 팔쿈치 → 팔 방향 측정점
   *
   * 계산 방식:
   *   기준 벡터: 어깨 → 수직 아래 (어깨 x, 어깨 y+100)
   *   측정 벡터: 어깨 → 팔쿈치
   *   방향 보정: 팔쿈치가 어깨보다 왼쪽(x 작음)이면 양수
   *
   * 정상 기준: 180°
   */
  private checkJointMovingRight(sRightShoulder: Point, eRightShoulder: Point, eRightElbow: Point) {
    if (!eRightShoulder || !eRightElbow) return null;

    let angle = calculateAngleBetweenVectors(
      eRightShoulder,
      new Point(eRightShoulder.x, eRightShoulder.y + 100), // 수직 아래 기준선
      eRightShoulder,
      eRightElbow,
    );
    // 오른쪽 벌림: 팔꿈치가 어깨보다 화면 왼쪽(x 작음)이면 정방향
    // 팔꿈치가 어깨보다 위에 있고 화면 오른쪽(x 큼)이면 180° 초과(과가동)
    if (eRightElbow.x < eRightShoulder.x) {
      // angle as computed (0~180)
    } else if (eRightElbow.y < eRightShoulder.y) {
      angle = 360 - angle; // 180° 초과: 벡터 각도 반전 보정
    } else {
      angle = 0;
    }

    const normalAngle = 180;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.SHOULDER_LARGE) ?? undefined;
    return {
      result: angle,
      score: Math.min(100, Math.max(0, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.SHOULDER_JOINT_MOVING_RIGHT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.SHOULDER_JOINT_MOVING_RIGHT,
      hypermobilityLevel,
    };
  }

  /**
   * 왼쪽 어깨 보외전 (Left Shoulder Abduction) 각도 계산
   *
   * 사용 랜드마크 (정면 촬영):
   *   eLeftShoulder: 끝 자세 왼쪽 어깨 → 기준 축
   *   eLeftElbow:    끝 자세 왼쪽 팔쿈치 → 팔 방향 측정점
   *
   * 계산 방식:
   *   기준 벡터: 어깨 → 수직 아래
   *   측정 벡터: 어깨 → 팔쿈치
   *   방향 보정: 팔쿈치가 어깨보다 오른쪽(x 큼)이면 양수
   *
   * 정상 기준: 180°
   */
  private checkJointMovingLeft(sLeftShoulder: Point, eLeftShoulder: Point, eLeftElbow: Point) {
    if (!eLeftShoulder || !eLeftElbow) return null;

    let angle = calculateAngleBetweenVectors(
      eLeftShoulder,
      new Point(eLeftShoulder.x, eLeftShoulder.y + 100), // 수직 아래 기준선
      eLeftShoulder,
      eLeftElbow,
    );
    // 왼쪽 벌림: 팔꿈치가 어깨보다 화면 오른쪽(x 큼)이면 정방향
    // 팔꿈치가 어깨보다 위에 있고 화면 왼쪽(x 작음)이면 180° 초과(과가동)
    if (eLeftElbow.x > eLeftShoulder.x) {
      // angle as computed (0~180)
    } else if (eLeftElbow.y < eLeftShoulder.y) {
      angle = 360 - angle; // 180° 초과: 벡터 각도 반전 보정
    } else {
      angle = 0;
    }

    const normalAngle = 180;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.SHOULDER_LARGE) ?? undefined;
    return {
      result: angle,
      score: Math.min(100, Math.max(0, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.SHOULDER_JOINT_MOVING_LEFT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.SHOULDER_JOINT_MOVING_LEFT,
      hypermobilityLevel,
    };
  }
  /**
   * 오른쪽 어깨 보안(Adduction) 각도 계산
   *
   * 사용 랜드마크 (정면 촬영):
   *   eRightShoulder: 끝 자세 오른쪽 어깨 → 기준 축
   *   eRightElbow:    끝 자세 오른쪽 팔쿈치 → 측정점
   *
   * 계산 방식:
   *   기준 벡터: 어깨 → 수직 아래
   *   측정 벡터: 어깨 → 팔쿈치
   *   방향 보정: 팔쿈치가 어깨보다 오른쪽(바짜쪽으로)이면 양수
   *
   * 정상 기준: 45°
   */  // 모음 (Adduction) 로직
  private checkJointAdductionRight(sRightShoulder: Point, eRightShoulder: Point, eRightElbow: Point) {
    if (!eRightShoulder || !eRightElbow) return null;

    let angle = calculateAngleBetweenVectors(
      eRightShoulder,
      new Point(eRightShoulder.x, eRightShoulder.y + 100), // 수직 아래 기준선
      eRightShoulder,
      eRightElbow,
    );
    // 오른쪽 모음: 팔꿈치가 어깨보다 화면 오른쪽(몸 안쪽)이면 양수, 바깥쪽이면 음수
    angle = eRightElbow.x > eRightShoulder.x ? angle : 0;

    const normalAngle = 45;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.SHOULDER_SMALL) ?? undefined;
    return {
      result: angle,
      score: Math.min(100, Math.max(0, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.SHOULDER_JOINT_ADDUCTION_RIGHT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.SHOULDER_JOINT_ADDUCTION_RIGHT,
      hypermobilityLevel,
    };
  }

  /**
   * 왼쪽 어깨 보안(Adduction) 각도 계산
   *
   * 사용 랜드마크 (정면 촬영):
   *   eLeftShoulder: 끝 자세 왼쪽 어깨 → 기준 축
   *   eLeftElbow:    끝 자세 왼쪽 팔쿈치 → 측정점
   *
   * 계산 방식:
   *   기준 벡터: 어깨 → 수직 아래
   *   측정 벡터: 어깨 → 팔쿈치
   *   방향 보정: 팔쿈치가 어깨보다 왼쪽(바짜쪽으로)이면 양수
   *
   * 정상 기준: 45°
   */
  private checkJointAdductionLeft(sLeftShoulder: Point, eLeftShoulder: Point, eLeftElbow: Point) {
    if (!eLeftShoulder || !eLeftElbow) return null;

    let angle = calculateAngleBetweenVectors(
      eLeftShoulder,
      new Point(eLeftShoulder.x, eLeftShoulder.y + 100), // 수직 아래 기준선
      eLeftShoulder,
      eLeftElbow,
    );
    // 왼쪽 모음: 팔꿈치가 어깨보다 화면 왼쪽(몸 안쪽)이면 양수, 바깥쪽이면 음수
    angle = eLeftElbow.x < eLeftShoulder.x ? angle : 0;

    const normalAngle = 45;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.SHOULDER_SMALL) ?? undefined;
    return {
      result: angle,
      score: Math.min(100, Math.max(0, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.SHOULDER_JOINT_ADDUCTION_LEFT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.SHOULDER_JOINT_ADDUCTION_LEFT,
      hypermobilityLevel,
    };
  }

  /**
   * 오른쪽 어깨 굽힘 (Right Shoulder Flexion) 각도 계산
   *
   * 사용 랜드마크 (측면 촬영):
   *   eRightShoulder: 끝 자세 오른쪽 어깨 → 기준 축
   *   eRightElbow:    끝 자세 오른쪽 팔쿈치 → 측정점
   *
   * 계산 방식:
   *   기준: 수직 하향선
   *   앞으로 들든 뒤로 들든 각도 크기만 측정 (방향 부호 판정 없음)
   *   atan2로 0~180도 범위 측정
   *
   * 정상 기준: 180°
   */
  private checkJointBendingRight(
    eRightShoulder: Point,
    eRightElbow: Point,
  ) {
    if (!eRightShoulder || !eRightElbow) return null;

    const angle = this.calcFlexionAngle(eRightShoulder, eRightElbow);
    const normalAngle = 180;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.SHOULDER_LARGE) ?? undefined;
    return {
      result: angle,
      score: Math.min(100, Math.max(0, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.SHOULDER_JOINT_BENDING_RIGHT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.SHOULDER_JOINT_BENDING_RIGHT,
      hypermobilityLevel,
    };
  }

  /**
   * 왼쪽 어깨 굽힘 (Left Shoulder Flexion) 각도 계산
   *
   * 사용 랜드마크 (측면 촬영):
   *   eLeftShoulder: 끝 자세 왼쪽 어깨 → 기준 축
   *   eLeftElbow:    끝 자세 왼쪽 팔쿈치 → 측정점
   *
   * 계산 방식:
   *   기준: 수직 하향선
   *   앞으로 들든 뒤로 들든 각도 크기만 측정 (방향 부호 판정 없음)
   *   atan2로 0~180도 범위 측정
   *
   * 정상 기준: 180°
   */
  private checkJointBendingLeft(
    eLeftShoulder: Point,
    eLeftElbow: Point,
  ) {
    if (!eLeftShoulder || !eLeftElbow) return null;

    const angle = this.calcFlexionAngle(eLeftShoulder, eLeftElbow);
    const normalAngle = 180;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.SHOULDER_LARGE) ?? undefined;
    return {
      result: angle,
      score: Math.min(100, Math.max(0, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.SHOULDER_JOINT_BENDING_LEFT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.SHOULDER_JOINT_BENDING_LEFT,
      hypermobilityLevel,
    };
  }
  /**
   * 오른쪽 어깨 폴 (Right Shoulder Extension) 각도 계산
   *
   * 사용 랜드마크 (측면 촬영):
   *   eRightShoulder: 끝 자세 오른쪽 어깨 → 기준 축
   *   eRightElbow:    끝 자세 오른쪽 팔쿈치 → 측정점
   *
   * 계산 방식:
   *   기준 벡터: 어깨 → 수직 아래
   *   측정 벡터: 어깨 → 팔쿈치
   *   방향 보정: 우측면에서 팔쿈치가 어깨보다 왼쪽(혼 뒤쪽)이면 양수
   *
   * 정상 기준: 50°
   */
  private checkJointStraighteningRight(
    eRightShoulder: Point,
    eRightElbow: Point,
  ) {
    if (!eRightShoulder || !eRightElbow) return null;

    let angle = calculateAngleBetweenVectors(
      eRightShoulder,
      new Point(eRightShoulder.x, eRightShoulder.y + 100), // 수직 아래 기준선
      eRightShoulder,
      eRightElbow,
    );
    // 오른쪽 편: 팔꿈치가 어깨보다 화면 왼쪽(몸 뒤쪽)이면 양수, 앞쪽이면 음수
    angle = eRightElbow.x < eRightShoulder.x ? angle : 0;

    const normalAngle = 50;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.SHOULDER_SMALL) ?? undefined;
    return {
      result: angle,
      score: Math.min(100, Math.max(0, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.SHOULDER_JOINT_STRAIGHTENING_RIGHT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.SHOULDER_JOINT_STRAIGHTENING_RIGHT,
      hypermobilityLevel,
    };
  }

  /**
   * 왼쪽 어깨 폴 (Left Shoulder Extension) 각도 계산
   *
   * 사용 랜드마크 (측면 촬영):
   *   eLeftShoulder: 끝 자세 왼쪽 어깨 → 기준 축
   *   eLeftElbow:    끝 자세 왼쪽 팔쿈치 → 측정점
   *
   * 계산 방식:
   *   기준 벡터: 어깨 → 수직 아래
   *   측정 벡터: 어깨 → 팔쿈치
   *   방향 보정: 좌측면에서 팔쿈치가 어깨보다 오른쪽(혼 뒤쪽)이면 양수
   *
   * 정상 기준: 50°
   */
  private checkJointStraighteningLeft(
    eLeftShoulder: Point,
    eLeftElbow: Point,
  ) {
    if (!eLeftShoulder || !eLeftElbow) return null;

    let angle = calculateAngleBetweenVectors(
      eLeftShoulder,
      new Point(eLeftShoulder.x, eLeftShoulder.y + 100), // 수직 아래 기준선
      eLeftShoulder,
      eLeftElbow,
    );
    // 왼쪽 편: 팔꿈치가 어깨보다 화면 오른쪽(몸 뒤쪽)이면 양수, 앞쪽이면 음수
    angle = eLeftElbow.x > eLeftShoulder.x ? angle : 0;

    const normalAngle = 50;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.SHOULDER_SMALL) ?? undefined;
    return {
      result: angle,
      score: Math.min(100, Math.max(0, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.SHOULDER_JOINT_STRAIGHTENING_LEFT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.SHOULDER_JOINT_STRAIGHTENING_LEFT,
      hypermobilityLevel,
    };
  }
  /**
   * 오른쪽 어깨 안쪽돌림 (Right Shoulder Internal Rotation) 각도 계산
   *
   * 사용 랜드마크 (우측면 촬영, 팔쿈치 90° 굽힌 상태):
   *   eRightElbow: 끝 자세 오른쪽 팔쿈치 → 기준 축
   *   eRightWrist: 끝 자세 오른쪽 손목 → 레 방향 측정점
   *
   * 계산 방식:
   *   기준 벡터: 팔쿈치 → 수평 오른쪽 (팔쿈치 x+100, 팔쿈치 y)
   *   측정 벡터: 팔쿈치 → 손목
   *   방향 보정: 손목이 팔쿈치보다 아래(y 큼)면 양수
   *
   * 정상 기준: 70°
   */
  private checkJointTurningInRight(
    sRightWrist: Point,
    sRightElbow: Point,
    eRightWrist: Point,
    eRightElbow: Point,
  ) {
    if (!eRightElbow || !eRightWrist) return null;

    let angle = calculateAngleBetweenVectors(
      eRightElbow,
      new Point(eRightElbow.x + 100, eRightElbow.y), // 수평 전방 기준선 (우측면)
      eRightElbow,
      eRightWrist,
    );
    // 안쪽돌림: 손목이 팔꿈치보다 아래(y 클)면 양수, 위로 올라가면 음수
    angle = eRightWrist.y > eRightElbow.y ? angle : 0;

    const normalAngle = 70;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.SHOULDER_SMALL) ?? undefined;
    return {
      result: angle,
      score: Math.min(100, Math.max(0, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.SHOULDER_JOINT_TURNING_IN_RIGHT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.SHOULDER_JOINT_TURNING_IN_RIGHT,
      hypermobilityLevel,
    };
  }

  /**
   * 왼쪽 어깨 안쪽돌림 (Left Shoulder Internal Rotation) 각도 계산
   *
   * 사용 랜드마크 (좌측면 촬영, 팔쿈치 90° 굽힌 상태):
   *   eLeftElbow: 끝 자세 왼쪽 팔쿈치 → 기준 축
   *   eLeftWrist: 끝 자세 왼쪽 손목 → 레 방향 측정점
   *
   * 계산 방식:
   *   기준 벡터: 팔쿈치 → 수평 왼쪽 (팔쿈치 x-100, 팔쿈치 y)
   *   측정 벡터: 팔쿈치 → 손목
   *   방향 보정: 손목이 팔쿈치보다 아래(y 큼)면 양수
   *
   * 정상 기준: 70°
   */
  private checkJointTurningInLeft(
    sLeftWrist: Point,
    sLeftElbow: Point,
    eLeftWrist: Point,
    eLeftElbow: Point,
  ) {
    if (!eLeftElbow || !eLeftWrist) return null;

    let angle = calculateAngleBetweenVectors(
      eLeftElbow,
      new Point(eLeftElbow.x - 100, eLeftElbow.y), // 수평 전방 기준선 (좌측면)
      eLeftElbow,
      eLeftWrist,
    );
    // 안쪽돌림: 손목이 팔꿈치보다 아래(y 클)면 양수, 위로 올라가면 음수
    angle = eLeftWrist.y > eLeftElbow.y ? angle : 0;

    const normalAngle = 70;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.SHOULDER_SMALL) ?? undefined;
    return {
      result: angle,
      score: Math.min(100, Math.max(0, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.SHOULDER_JOINT_TURNING_IN_LEFT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.SHOULDER_JOINT_TURNING_IN_LEFT,
      hypermobilityLevel,
    };
  }
  /**
   * 오른쪽 어깨 바깥쪽돌림 (Right Shoulder External Rotation) 각도 계산
   *
   * 사용 랜드마크 (우측면 촬영, 팔쿈치 90° 굽힌 상태):
   *   eRightElbow: 끝 자세 오른쪽 팔쿈치 → 기준 축
   *   eRightWrist: 끝 자세 오른쪽 손목 → 레 방향 측정점
   *
   * 계산 방식:
   *   기준 벡터: 팔쿈치 → 수평 오른쪽
   *   측정 벡터: 팔쿈치 → 손목
   *   방향 보정: 손목이 팔쿈치보다 위(y 작)면 양수
   *
   * 정상 기준: 90°
   */
  private checkJointTurningOutRight(
    sRightWrist: Point,
    sRightElbow: Point,
    eRightWrist: Point,
    eRightElbow: Point,
  ) {
    if (!eRightElbow || !eRightWrist) return null;

    let angle = calculateAngleBetweenVectors(
      eRightElbow,
      new Point(eRightElbow.x + 100, eRightElbow.y), // 수평 전방 기준선 (우측면)
      eRightElbow,
      eRightWrist,
    );
    // 바깥돌림: 손목이 팔꿈치보다 위(y 작)면 양수, 아래로 내려가면 음수
    angle = eRightWrist.y < eRightElbow.y ? angle : 0;

    const normalAngle = 90;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.SHOULDER_SMALL) ?? undefined;
    return {
      result: angle,
      score: Math.min(100, Math.max(0, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.SHOULDER_JOINT_TURNING_OUT_RIGHT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.SHOULDER_JOINT_TURNING_OUT_RIGHT,
      hypermobilityLevel,
    };
  }

  /**
   * 왼쪽 어깨 바깥쪽돌림 (Left Shoulder External Rotation) 각도 계산
   *
   * 사용 랜드마크 (좌측면 촬영, 팔쿈치 90° 굽힌 상태):
   *   eLeftElbow: 끝 자세 왼쪽 팔쿈치 → 기준 축
   *   eLeftWrist: 끝 자세 왼쪽 손목 → 레 방향 측정점
   *
   * 계산 방식:
   *   기준 벡터: 팔쿈치 → 수평 왼쪽
   *   측정 벡터: 팔쿈치 → 손목
   *   방향 보정: 손목이 팔쿈치보다 위(y 작)면 양수
   *
   * 정상 기준: 90°
   */
  private checkJointTurningOutLeft(
    sLeftWrist: Point,
    sLeftElbow: Point,
    eLeftWrist: Point,
    eLeftElbow: Point,
  ) {
    if (!eLeftElbow || !eLeftWrist) return null;

    let angle = calculateAngleBetweenVectors(
      eLeftElbow,
      new Point(eLeftElbow.x - 100, eLeftElbow.y), // 수평 전방 기준선 (좌측면)
      eLeftElbow,
      eLeftWrist,
    );
    // 바깥돌림: 손목이 팔꿈치보다 위(y 작)면 양수, 아래로 내려가면 음수
    angle = eLeftWrist.y < eLeftElbow.y ? angle : 0;

    const normalAngle = 90;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.SHOULDER_SMALL) ?? undefined;
    return {
      result: angle,
      score: Math.min(100, Math.max(0, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.SHOULDER_JOINT_TURNING_OUT_LEFT_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.SHOULDER_JOINT_TURNING_OUT_LEFT,
      hypermobilityLevel,
    };
  }

  /**
   * 어깨 굽힘 각도 계산 (수직 하향 기준)
   *
   * 어깨를 축으로 수직 아래(0도)에서 수직 위(180도)까지의 각도 측정
   * 앞으로 들든 뒤로 들든 절대 각도만 계산 (방향 구분 없음)
   *
   * @returns 0~180도 범위의 각도
   */
  private calcFlexionAngle(shoulder: Point, elbow: Point): number {
    const dx = elbow.x - shoulder.x;
    const dy = elbow.y - shoulder.y;

    // atan2(수평성분, 수직성분)으로 수직 기준 각도 계산
    // dy > 0 (아래): 0~90도
    // dy < 0 (위): 90~180도
    const angle = Math.atan2(Math.abs(dx), dy) * (180 / Math.PI);
    return angle;
  }
}
