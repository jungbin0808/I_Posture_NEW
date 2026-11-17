import { PRECISE_DISEASES } from '../../../common/enums/precise-diseases.enum';
import { Point } from '../helpers/point.helper';
import { getResponse } from '../helpers/precise-response.helper';
import { calculateAngleBetweenVectors } from '../helpers/angle.helper';
import { AnalyticResult } from './analytic.result';
import { AnalyticStrategy } from './analytic.strategy';
import { DiseaseResult, Landmarks } from '../analysis.types';
import { PreciseHelper } from '../helpers/precise.helper';
import { getHypermobilityLevel, HYPER_STAGES } from '../helpers/hypermobility.helper';

/**
 * 목(Neck) ROM 측정 전략
 *
 * 측정 항목:
 *   - 좌/우 가쪽굽힘 (Lateral Flexion): 목을 옆으로 기울이는 동작
 *   - 굽힘 (Flexion): 목을 앞으로 숙이는 동작
 *   - 폄 (Extension): 목을 뒤로 젖히는 동작
 *   - 좌/우 회전 (Rotation): 목을 좌우로 돌리는 동작
 *
 * 모든 각도 계산에 사용되는 좌표계:
 *   - 화면 픽셀 좌표 (x: 왼쪽→오른쪽, y: 위→아래)
 *   - MediaPipe Pose 랜드마크에서 추출
 */
export class NeckStrategy implements AnalyticStrategy {
  /**
   * 목 ROM 전체 측정 실행
   *
   * 랜드마크 키 구조:
   *   start_bend_right  / end_bend_right   → 오른쪽 가쪽굽힘 측정용
   *   start_bend_left   / end_bend_left    → 왼쪽 가쪽굽힘 측정용
   *   start_forward_right / end_forward_right → 굽힘(앞으로 숙임) 측정용
   *   start_backward_left / end_backward_left → 폄(뒤로 젖힘) 측정용
   *   start_rotation_right / end_rotation_right → 오른쪽 회전 측정용
   *   start_rotation_left  / end_rotation_left  → 왼쪽 회전 측정용
   */
  async execute(landmarks: Landmarks): Promise<AnalyticResult> {
    const disease: DiseaseResult[] = [];
    const scoreDetail = {
      // 오른쪽 가쪽굽힘: 시작 자세 어깨 + 끝 자세 코·어깨 사용
      sideBendRight: landmarks?.start_bend_right ? this.checkSideBendRight(
        landmarks.start_bend_right.RightShoulder,
        landmarks.start_bend_right.LeftShoulder,
        landmarks.end_bend_right.Nose,
        landmarks.end_bend_right.RightShoulder,
        landmarks.end_bend_right.LeftShoulder,
      ) : null,
      // 왼쪽 가쪽굽힘: 시작 자세 어깨 + 끝 자세 코·어깨 사용
      sideBendLeft: landmarks?.start_bend_left ? this.checkSideBendLeft(
        landmarks.start_bend_left.RightShoulder,
        landmarks.start_bend_left.LeftShoulder,
        landmarks.end_bend_left.Nose,
        landmarks.end_bend_left.RightShoulder,
        landmarks.end_bend_left.LeftShoulder,
      ) : null,
      // 굽힘(앞으로 숙임): 좌측면 촬영 → 카메라에 가까운 왼쪽 귀 + 왼쪽 눈 바깥쪽 사용
      bendingForward: landmarks?.start_forward_right ? this.checkBendingForward(
        landmarks.start_forward_right.LeftEar,
        landmarks.end_forward_right.LeftEar,
        landmarks.end_forward_right.LeftEyeOuter,
      ) : null,
      // 폄(뒤로 젖힘): 좌측면 촬영 → 카메라에 가까운 왼쪽 귀 + 왼쪽 눈 바깥쪽 사용
      bendingBackward: landmarks?.start_backward_left ? this.checkBendingBackward(
        landmarks.start_backward_left.LeftEar,
        landmarks.end_backward_left.LeftEar,
        landmarks.end_backward_left.LeftEyeOuter,
      ) : null,
      // 오른쪽 회전: 끝 자세 코·어깨 중심 사용
      rotationRight: landmarks?.start_rotation_right ? this.checkRotationRight(
        landmarks.start_rotation_right,
        landmarks.end_rotation_right,
      ) : null,
      // 왼쪽 회전: 끝 자세 코·어깨 중심 사용
      rotationLeft: landmarks?.start_rotation_left ? this.checkRotationLeft(
        landmarks.start_rotation_left,
        landmarks.end_rotation_left,
      ) : null,
    };

    // NORMAL이 아닌 항목은 disease 배열에 추가
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
   * 목 오른쪽 가쪽굽힘 (Right Lateral Flexion) 각도 계산
   *
   * 사용 랜드마크:
   *   sRightShoulder: 시작 자세 오른쪽 어깨 좌표
   *   sLeftShoulder:  시작 자세 왼쪽 어깨 좌표
   *   eNose:          끝 자세(오른쪽으로 기울인 후) 코 좌표
   *   eRightShoulder: 끝 자세 오른쪽 어깨 좌표
   *   eLeftShoulder:  끝 자세 왼쪽 어깨 좌표
   *
   * 계산 방식:
   *   1. 끝 자세 어깨 중심점 계산
   *      x4 = (eRightShoulder.x + eLeftShoulder.x) / 2
   *      y4 = (eRightShoulder.y + eLeftShoulder.y) / 2
   *      예) x4 = (183.5 + 280.3) / 2 = 231.9
   *          y4 = (163.5 + 170.6) / 2 = 167.1
   *
   *   2. 기준 벡터: 어깨 중심점 → 수직 위 방향
   *      벡터A = (x4, y4) → (x4, 0)  [화면 위쪽 방향]
   *
   *   3. 측정 벡터: 어깨 중심점 → 코
   *      벡터B = (x4, y4) → (eNose.x, eNose.y)
   *      예) (231.9, 167.1) → (253.8, 107.8)
   *
   *   4. 두 벡터의 사잇각(코사인 공식) = 측정 각도
   *      예) 20.3°
   *
   *   5. 방향 보정: 오른쪽 굽힘이면 코가 어깨 중심보다 왼쪽(eNose.x < x4)
   *      → 양수 유지, 반대이면 음수(잘못된 방향)
   *
   * 정상 기준:  45°
   * score(%) = (측정값 / 45) × 100
   *   예) 20.3° → score = 45.1%
   */
  private checkSideBendRight(
    sRightShoulder: Point, // 시작 자세 오른쪽 어깨
    sLeftShoulder: Point,  // 시작 자세 왼쪽 어깨
    eNose: Point,          // 끝 자세 코 (머리가 기울어진 위치)
    eRightShoulder: Point, // 끝 자세 오른쪽 어깨
    eLeftShoulder: Point,  // 끝 자세 왼쪽 어깨
  ) {
    if (!sRightShoulder || !sLeftShoulder || !eNose || !eRightShoulder || !eLeftShoulder) return null;

    // 시작 자세 어깨 중심점 (현재 미사용, 끝 자세 중심점으로 각도 계산)
    const x3 = (sRightShoulder.x + sLeftShoulder.x) / 2;
    const y3 = (sRightShoulder.y + sLeftShoulder.y) / 2;

    // 끝 자세 어깨 중심점: 두 어깨의 정중앙 → 기준 축(origin) 역할
    const x4 = (eRightShoulder.x + eLeftShoulder.x) / 2;
    const y4 = (eRightShoulder.y + eLeftShoulder.y) / 2;

    // 기준 벡터(수직 위): (x4, y4) → (x4, 0)
    // 측정 벡터(코 방향): (x4, y4) → (eNose.x, eNose.y)
    // calculateAngleBetweenVectors(A, B, C, D) = 벡터AB와 벡터CD의 사잇각
    let angle = calculateAngleBetweenVectors(
      new Point(x3, y3),  // 벡터 AB의 시작점 (어깨 중심)
      new Point(x3, 0),   // 벡터 AB의 끝점 (수직 위)
      new Point(x4, y4),  // 벡터 CD의 시작점 (어깨 중심)
      eNose,              // 벡터 CD의 끝점 (코 위치)
    );

    // 방향 보정: 오른쪽으로 기울면 코가 어깨 중심보다 왼쪽(화면 기준 x값이 작아짐)
    // 화면 좌표계 x: 왼쪽=작음, 오른쪽=큼
    angle = eNose.x < x4 ? angle : -angle;

    // 보정계수 1.6 적용, 반대 방향(음수)은 0 처리, 최대 45° 제한
    angle = angle > 0 ? Math.min(angle * 1.6, 45) : 0;

    // 정상 기준값: 목 가쪽굽힘 정상 범위 45°
    const normalAngle = 45;
    return {
      result: angle,                                    // 측정 각도 (도)
      score: Math.max(0, (angle / normalAngle) * 100), // 정상 대비 퍼센트
      disease: angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.NECK_SIDE_BEND_RIGHT,
    };
  }

  /**
   * 목 왼쪽 가쪽굽힘 (Left Lateral Flexion) 각도 계산
   *
   * 사용 랜드마크:
   *   sRightShoulder: 시작 자세 오른쪽 어깨 좌표
   *   sLeftShoulder:  시작 자세 왼쪽 어깨 좌표
   *   eNose:          끝 자세(왼쪽으로 기울인 후) 코 좌표
   *   eRightShoulder: 끝 자세 오른쪽 어깨 좌표
   *   eLeftShoulder:  끝 자세 왼쪽 어깨 좌표
   *
   * 계산 방식 (오른쪽과 동일, 방향만 반대):
   *   어깨 중심 → 수직 위 벡터와 어깨 중심 → 코 벡터의 사잇각
   *   방향 보정: 왼쪽 굽힘이면 코가 어깨 중심보다 오른쪽(eNose.x > x4)
   *
   * 실제 측정 예시 (2026-04-12 회원 데이터):
   *   끝 자세 오른쪽 어깨: (183.5, 163.5)
   *   끝 자세 왼쪽 어깨:  (280.3, 170.6)
   *   어깨 중심: ((183.5+280.3)/2, (163.5+170.6)/2) = (231.9, 167.1)
   *   코 위치: (253.8, 107.8)
   *   → 측정 각도 = 20.3°
   *   → score = (20.3 / 45) × 100 = 45.1%
   *   → 판정: NECK_SIDE_BEND_LEFT (제한 있음)
   *
   * 정상 기준: 45°
   */
  private checkSideBendLeft(
    sRightShoulder: Point, // 시작 자세 오른쪽 어깨
    sLeftShoulder: Point,  // 시작 자세 왼쪽 어깨
    eNose: Point,          // 끝 자세 코 (머리가 기울어진 위치)
    eRightShoulder: Point, // 끝 자세 오른쪽 어깨
    eLeftShoulder: Point,  // 끝 자세 왼쪽 어깨
  ) {
    if (!sRightShoulder || !sLeftShoulder || !eNose || !eRightShoulder || !eLeftShoulder) return null;

    // 시작 자세 어깨 중심점
    const x3 = (sRightShoulder.x + sLeftShoulder.x) / 2;
    const y3 = (sRightShoulder.y + sLeftShoulder.y) / 2;

    // 끝 자세 어깨 중심점: 두 어깨의 정중앙 → 기준 축(origin) 역할
    const x4 = (eRightShoulder.x + eLeftShoulder.x) / 2;
    const y4 = (eRightShoulder.y + eLeftShoulder.y) / 2;

    // 기준 벡터(수직 위): (x4, y4) → (x4, 0)
    // 측정 벡터(코 방향): (x4, y4) → (eNose.x, eNose.y)
    let angle = calculateAngleBetweenVectors(
      new Point(x3, y3),  // 벡터 AB의 시작점 (어깨 중심)
      new Point(x3, 0),   // 벡터 AB의 끝점 (수직 위)
      new Point(x4, y4),  // 벡터 CD의 시작점 (어깨 중심)
      eNose,              // 벡터 CD의 끝점 (코 위치)
    );

    // 방향 보정: 왼쪽으로 기울면 코가 어깨 중심보다 오른쪽(화면 기준 x값이 커짐)
    angle = eNose.x > x4 ? angle : -angle;

    // 보정계수 1.6 적용, 반대 방향(음수)은 0 처리, 최대 45° 제한
    angle = angle > 0 ? Math.min(angle * 1.6, 45) : 0;

    // 정상 기준값: 목 가쪽굽힘 정상 범위 45°
    const normalAngle = 45;
    return {
      result: angle,                                    // 측정 각도 (도)
      score: Math.max(0, (angle / normalAngle) * 100), // 정상 대비 퍼센트
      disease: angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.NECK_SIDE_BEND_LEFT,
    };
  }

  /**
   * 목 굽힘 (Neck Flexion, 앞으로 숙이기) 각도 계산
   *
   * 사용 랜드마크 (좌측면 촬영):
   *   sLeftEar:      시작 자세 왼쪽 귀 좌표
   *   eLeftEar:      끝 자세(앞으로 숙인 후) 왼쪽 귀 좌표
   *   eLeftEyeOuter: 끝 자세 왼쪽 눈 바깥쪽 좌표
   *
   * 계산 방식 (기획서 원안):
   *   축(Axis): 끝 자세 귀(eLeftEar)
   *   시작선: 귀에서 수평 오른쪽으로 뻗은 선 (수평 기준선)
   *   측정선: 귀 → 눈 바깥쪽 연결선
   *   → 수평 기준선과 귀-눈 연결선 사이의 각도 = 목 굽힘 각도
   *
   *   방향 보정: 앞으로 숙이면 눈이 귀보다 아래(eLeftEyeOuter.y > eLeftEar.y)
   *
   * 정상 기준: 80°
   */
  private checkBendingForward(
    sLeftEar: Point,       // 시작 자세 왼쪽 귀 (현재 미사용)
    eLeftEar: Point,       // 끝 자세 왼쪽 귀 → 각도 계산 축
    eLeftEyeOuter: Point,  // 끝 자세 왼쪽 눈 바깥쪽 → 측정선 끝점
  ) {
    if (!sLeftEar || !eLeftEar || !eLeftEyeOuter) return null;

    // 수평 기준선: 귀에서 오른쪽으로 100px
    // 측정선: 귀 → 눈 바깥쪽
    let angle = calculateAngleBetweenVectors(
      eLeftEar,
      new Point(eLeftEar.x + 100, eLeftEar.y),
      eLeftEar,
      eLeftEyeOuter,
    );

    // 방향 보정: 앞으로 숙이면 눈이 귀보다 아래(y값 큼)
    angle = eLeftEyeOuter.y > eLeftEar.y ? angle : 0;

    // 보정계수 2.35 적용 (80 ÷ 34 = 2.35, 최대 34° → 80°로 스케일 확대)
    angle = Math.min(angle * 2.35, 80);

    const normalAngle = 80;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.NECK) ?? undefined;
    return {
      result: angle,
      score: Math.min(100, Math.max(0, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.NECK_BENDING_FORWARD_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.NECK_BENDING_FORWARD,
      hypermobilityLevel,
    };
  }

  /**
   * 목 폄 (Neck Extension, 뒤로 젖히기) 각도 계산
   *
   * 사용 랜드마크 (좌측면 촬영):
   *   sLeftEar:      시작 자세 왼쪽 귀 좌표
   *   eLeftEar:      끝 자세(뒤로 젖힌 후) 왼쪽 귀 좌표
   *   eLeftEyeOuter: 끝 자세 왼쪽 눈 바깥쪽 좌표
   *
   * 계산 방식 (기획서 원안, 굽힘과 동일 축·선):
   *   축(Axis): 끝 자세 귀(eLeftEar)
   *   시작선: 귀에서 수평 오른쪽으로 뻗은 선 (수평 기준선)
   *   측정선: 귀 → 눈 바깥쪽 연결선
   *
   *   방향 보정: 뒤로 젖히면 눈이 귀보다 위(eLeftEyeOuter.y < eLeftEar.y)
   *
   * 정상 기준: 70°
   */
  private checkBendingBackward(
    sLeftEar: Point,       // 시작 자세 왼쪽 귀 (현재 미사용)
    eLeftEar: Point,       // 끝 자세 왼쪽 귀 → 각도 계산 축
    eLeftEyeOuter: Point,  // 끝 자세 왼쪽 눈 바깥쪽 → 측정선 끝점
  ) {
    if (!sLeftEar || !eLeftEar || !eLeftEyeOuter) return null;

    // 수평 기준선: 귀에서 오른쪽으로 100px
    // 측정선: 귀 → 눈 바깥쪽
    let angle = calculateAngleBetweenVectors(
      eLeftEar,
      new Point(eLeftEar.x + 100, eLeftEar.y),
      eLeftEar,
      eLeftEyeOuter,
    );

    // 방향 보정: 뒤로 젖히면 눈이 귀보다 위(y값 작음)
    angle = eLeftEyeOuter.y < eLeftEar.y ? angle : 0;

    const normalAngle = 70;
    const excess = angle - normalAngle;
    const hypermobilityLevel = getHypermobilityLevel(excess, HYPER_STAGES.NECK) ?? undefined;
    return {
      result: angle,
      score: Math.min(100, Math.max(0, (angle / normalAngle) * 100)),
      disease: hypermobilityLevel
        ? PRECISE_DISEASES.NECK_BENDING_BACKWARD_HYPERMOBILITY
        : angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.NECK_BENDING_BACKWARD,
      hypermobilityLevel,
    };
  }

  /**
   * 목 오른쪽 회전 (Right Rotation) 각도 계산
   *
   * 사용 랜드마크 (정면 촬영):
   *   frontLandmarks:   시작 자세 랜드마크 (현재 미사용)
   *   rotatedLandmarks: 끝 자세(오른쪽으로 돌린 후) 랜드마크
   *     → Nose, RightShoulder, LeftShoulder 사용
   *
   * 계산 방식 (기획서 원안 - X-Y 평면 2D):
   *   축(Axis): 양쪽 어깨 중심점
   *   시작선: 어깨 중심 → 수직 위 방향
   *   측정선: 어깨 중심 → 코(Nose)
   *   → 수직선과 어깨중심-코 연결선 사이의 2D(X-Y) 각도
   *
   *   방향 보정: 오른쪽 회전 시 코가 어깨 중심보다 왼쪽(eNose.x < axisX)
   *
   * 정상 기준: 80°
   */
  private checkRotationRight(
    frontLandmarks: any,
    rotatedLandmarks: any,
  ) {
    if (!frontLandmarks || !rotatedLandmarks) return null;
    const eNose = rotatedLandmarks.Nose;
    const eRightShoulder = rotatedLandmarks.RightShoulder;
    const eLeftShoulder = rotatedLandmarks.LeftShoulder;
    if (!eNose || !eRightShoulder || !eLeftShoulder) return null;

    // 어깨 중심점: 두 어깨의 정중앙
    const axisX = (eRightShoulder.x + eLeftShoulder.x) / 2;
    const axisY = (eRightShoulder.y + eLeftShoulder.y) / 2;

    // 수직 기준선 vs 어깨중심→코 측정선
    let angle = calculateAngleBetweenVectors(
      new Point(axisX, axisY),
      new Point(axisX, 0),
      new Point(axisX, axisY),
      eNose,
    );

    // 방향 보정: 오른쪽으로 돌리면 코가 어깨 중심보다 왼쪽(x값 작아짐)
    angle = eNose.x < axisX ? angle : -angle;

    // 보정계수 4.3 적용: 1° 이하 무동작 처리, 최대 80° 제한
    angle = angle <= 1 ? 0 : Math.min(angle * 4.3, 80);

    const normalAngle = 80;
    return {
      result: angle,
      score: Math.max(0, (angle / normalAngle) * 100),
      disease: angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.NECK_ROTATION_RIGHT,
    };
  }

  /**
   * 목 왼쪽 회전 (Left Rotation) 각도 계산
   *
   * 계산 방식 (기획서 원안, 오른쪽과 동일 - 방향만 반대):
   *   축: 어깨 중심, 측정선: 어깨중심→코, 기준선: 수직 위
   *   방향 보정: 왼쪽 회전 시 코가 어깨 중심보다 오른쪽(eNose.x > axisX)
   *
   * 정상 기준: 80°
   */
  private checkRotationLeft(
    frontLandmarks: any,
    rotatedLandmarks: any,
  ) {
    if (!frontLandmarks || !rotatedLandmarks) return null;
    const eNose = rotatedLandmarks.Nose;
    const eRightShoulder = rotatedLandmarks.RightShoulder;
    const eLeftShoulder = rotatedLandmarks.LeftShoulder;
    if (!eNose || !eRightShoulder || !eLeftShoulder) return null;

    const axisX = (eRightShoulder.x + eLeftShoulder.x) / 2;
    const axisY = (eRightShoulder.y + eLeftShoulder.y) / 2;

    let angle = calculateAngleBetweenVectors(
      new Point(axisX, axisY),
      new Point(axisX, 0),
      new Point(axisX, axisY),
      eNose,
    );

    // 방향 보정: 왼쪽으로 돌리면 코가 어깨 중심보다 오른쪽(x값 커짐)
    angle = eNose.x > axisX ? angle : -angle;

    // 보정계수 4.3 적용: 1° 이하 무동작 처리, 최대 80° 제한
    angle = angle <= 1 ? 0 : Math.min(angle * 4.3, 80);

    const normalAngle = 80;
    return {
      result: angle,
      score: Math.max(0, (angle / normalAngle) * 100),
      disease: angle >= normalAngle ? 'NORMAL' : PRECISE_DISEASES.NECK_ROTATION_LEFT,
    };
  }
}
