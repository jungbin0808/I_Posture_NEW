import { PRECISE_DISEASES } from '../../../common/enums/precise-diseases.enum';
import { AnalyticResult } from './analytic.result';
import { AnalyticStrategy } from './analytic.strategy';
import { DiseaseResult, Landmarks, Point } from '../analysis.types';
import { BALANCE_ALIGNMENT } from '../analysis.constants';
import { resolveSupportingLegAlignment } from '../helpers/supporting-leg-alignment.helper';

/**
 * 균형감각검사 분석 전략
 *
 * 카메라 규약:
 *   front_right = 오른쪽 다리 든 사진 (왼발 지지구간)
 *   front_left  = 왼쪽 다리 든 사진  (오른발 지지구간)
 *   right       = 우측면 촬영 (오른발 든 구간)
 *   left        = 좌측면 촬영 (왼발 든 구간)
 *
 * 감점 체계 (총 10점 기준):
 *   기본항목(든 다리 무릎-발목):  좌/우 각 -0.3pt  (합산 최대 -0.6pt)
 *   균형패턴2(골반 높이):         좌/우 각 -0.3pt  (합산 최대 -0.6pt)
 *   균형패턴1(상체 좌우 기울기):  좌/우 각 -1pt    (합산 최대 -2pt)
 *   균형패턴3(지지 다리 정렬):    좌/우 각 -2pt    (합산 최대 -4pt)
 *   균형패턴4(상체 전후 기울기):  좌/우 각 -0.7pt  (합산 최대 -1.4pt)
 *   균형패턴5(든 다리 고관절):    좌/우 각 -0.7pt  (합산 최대 -1.4pt)
 */
export class BalanceTestStrategy implements AnalyticStrategy {
  async execute(landmarks: Landmarks): Promise<AnalyticResult> {
    const disease: DiseaseResult[] = [];
    const scoreDetail = {
      // 기본항목: 든 다리 무릎-발목 수직 상태 (좌/우 각 -0.3pt)
      frontLeg: this.checkFrontLeg(
        landmarks?.front_right?.RightKnee,   // 오른발 든 구간: Rt knee
        landmarks?.front_right?.RightAnkle,  // 오른발 든 구간: Rt ankle
        landmarks?.front_left?.LeftKnee,     // 왼발 든 구간: Lt knee
        landmarks?.front_left?.LeftAnkle,    // 왼발 든 구간: Lt ankle
      ),
      // 균형패턴2: 좌우 골반 높이 대칭 (좌/우 각 -0.3pt)
      hip: this.checkHip(
        landmarks?.front_right?.RightHip,    // 오른발 든 구간: Rt hip (든 쪽)
        landmarks?.front_right?.LeftHip,     // 오른발 든 구간: Lt hip (지지 쪽)
        landmarks?.front_left?.LeftHip,      // 왼발 든 구간: Lt hip (든 쪽)
        landmarks?.front_left?.RightHip,     // 왼발 든 구간: Rt hip (지지 쪽)
      ),
      // 균형패턴1: 상체 좌우 기울기 (좌/우 각 -1pt)
      verticalBody: this.checkVerticalBody(
        landmarks?.front_right?.LeftShoulder,  // 오른발 든 구간
        landmarks?.front_right?.LeftHip,
        landmarks?.front_right?.RightShoulder,
        landmarks?.front_right?.RightHip,
        landmarks?.front_left?.LeftShoulder,   // 왼발 든 구간
        landmarks?.front_left?.LeftHip,
        landmarks?.front_left?.RightShoulder,
        landmarks?.front_left?.RightHip,
      ),
      // 균형패턴3: 지지 다리 정렬 (좌/우 각 -2pt)
      horizontalBody: this.checkHorizontalBody(
        landmarks?.front_right?.RightKnee,     // 오른발 든 구간: Axis_A
        landmarks?.front_right?.LeftHip,
        landmarks?.front_right?.LeftKnee,
        landmarks?.front_right?.LeftAnkle,
        landmarks?.front_left?.LeftKnee,       // 왼발 든 구간: Axis_A
        landmarks?.front_left?.RightHip,
        landmarks?.front_left?.RightKnee,
        landmarks?.front_left?.RightAnkle,
      ),
      // 균형패턴4: 상체 전후 기울기 (좌/우 각 -0.7pt)
      head: this.checkHead(
        landmarks?.right?.RightShoulder,     // 우측면: 오른발 든 구간
        landmarks?.right?.RightHip,
        landmarks?.left?.LeftShoulder,       // 좌측면: 왼발 든 구간
        landmarks?.left?.LeftHip,
      ),
      // 균형패턴5: 든 다리 엉덩관절 높이 (좌/우 각 -0.7pt)
      sideLeg: this.checkSideLeg(
        landmarks?.right?.RightHip,          // 우측면: Rt hip, Rt knee
        landmarks?.right?.RightKnee,
        landmarks?.left?.LeftHip,            // 좌측면: Lt hip, Lt knee
        landmarks?.left?.LeftKnee,
      ),
    };

    Object.values(scoreDetail).forEach(detail => {
      if (detail.disease !== 'NORMAL') {
        disease.push({ key: detail.disease, level: '', score: 0 });
      }
    });

    const score =
      scoreDetail.frontLeg.score +
      scoreDetail.hip.score +
      scoreDetail.verticalBody.score +
      scoreDetail.horizontalBody.score +
      scoreDetail.head.score +
      scoreDetail.sideLeg.score;

    return new AnalyticResult(score, scoreDetail, disease);
  }

  // ─────────────────────────────────────────────────────────────
  // 헬퍼
  // ─────────────────────────────────────────────────────────────

  /**
   * 두 점을 잇는 선의 수평선 대비 부호 있는 각도 (도)
   * p1→p2 기준: p2.x > p1.x 이면 양수(우상향), p2.x < p1.x 이면 음수(좌상향)
   * 측면뷰: shoulder→hip (위→아래), hip.y > shoulder.y 이므로 dy>0
   *   우측면: shoulder.x > hip.x → dx>0 → 양수 (forward)
   *           shoulder.x < hip.x → dx<0 → 음수 (backward)
   * 스펙 기준: -4° ~ -17° 정상 (뒤로 기울어짐 = shoulder가 hip보다 뒤쪽)
   */
  private signedAngleFromHorizontal(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.atan2(dx, dy) * (180 / Math.PI);
  }

  /**
   * hip-knee 연결선의 수평선 대비 부호 있는 각도 (도)
   * hip→knee 기준: knee.y < hip.y (위로 올라감) → dy<0
   *   양수 = knee가 hip보다 위, 음수 = knee가 hip보다 아래
   *   좌/우 촬영 방향에 따라 x부호가 바뀌어도 높이 판정이 뒤집히지 않아야 하므로
   *   분모는 |dx|를 사용하고 별도 x부호 보정은 적용하지 않는다.
   * 스펙 기준: -11° ~ +6° 정상
   */
  private hipKneeAngle(hip: Point, knee: Point): number {
    const dx = knee.x - hip.x;
    const dy = hip.y - knee.y; // hip.y - knee.y: 양수면 knee가 위
    return Math.atan2(dy, Math.abs(dx)) * (180 / Math.PI);
  }

  /** A-B-C 꺾임에서 B 꼭짓점의 각도 (도, 0~180) */
  private angleAtB(a: Point, b: Point, c: Point): number {
    const bax = a.x - b.x, bay = a.y - b.y;
    const bcx = c.x - b.x, bcy = c.y - b.y;
    const dot = bax * bcx + bay * bcy;
    const mag = Math.sqrt(bax ** 2 + bay ** 2) * Math.sqrt(bcx ** 2 + bcy ** 2);
    if (mag === 0) return 180;
    return Math.acos(Math.min(1, Math.max(-1, dot / mag))) * (180 / Math.PI);
  }

  /**
   * 무릎-발목 수평 오프셋 각도 (부호 있음)
   * 정면 비미러 기준:
   *   오른발: ankle이 knee보다 화면 오른쪽(큰 x) → 안쪽돌림 (음수)
   *           ankle이 knee보다 화면 왼쪽(작은 x) → 가쪽돌림 (양수)
   *   왼발:   ankle이 knee보다 화면 왼쪽(작은 x) → 안쪽돌림 (음수)
   *           ankle이 knee보다 화면 오른쪽(큰 x) → 가쪽돌림 (양수)
   * 부호 규칙: knee 기준 ankle이 바깥 방향 → 양수(가쪽돌림), 안쪽 방향 → 음수(안쪽돌림)
   */
  private kneeAnkleLateralAngle(knee: Point, ankle: Point, isRight: boolean): number {
    // 정면 비미러: 오른쪽 신체 = 화면 오른쪽(큰 x)
    // 오른발: 바깥 방향 = 왼쪽(작은 x) → ankle.x < knee.x → 가쪽돌림(+)
    // 왼발:  바깥 방향 = 오른쪽(큰 x) → ankle.x > knee.x → 가쪽돌림(+)
    const lateralDx = isRight
      ? knee.x - ankle.x   // 오른발: knee.x - ankle.x > 0 이면 가쪽
      : ankle.x - knee.x;  // 왼발:  ankle.x - knee.x > 0 이면 가쪽
    const dy = Math.abs(ankle.y - knee.y);
    const angle = Math.atan2(Math.abs(lateralDx), dy) * (180 / Math.PI);
    return lateralDx >= 0 ? angle : -angle;
  }

  // ─────────────────────────────────────────────────────────────
  // 기본항목: 든 다리 무릎-발목 수직 상태 (좌/우 각 -0.3pt)
  // 정상 범위: 가쪽돌림 0~+16°, 안쪽돌림 0~-7°
  // ─────────────────────────────────────────────────────────────
  private checkFrontLeg(
    r_rightKnee: Point, r_rightAnkle: Point,   // 오른발 든 구간
    l_leftKnee: Point,  l_leftAnkle: Point,    // 왼발 든 구간
  ) {
    let rightAngle = 0, leftAngle = 0;
    let rightOk = true, leftOk = true;

    if (r_rightKnee && r_rightAnkle) {
      rightAngle = this.kneeAnkleLateralAngle(r_rightKnee, r_rightAnkle, true);
      rightOk = rightAngle <= 16 && rightAngle >= -7;
    }
    if (l_leftKnee && l_leftAnkle) {
      leftAngle = this.kneeAnkleLateralAngle(l_leftKnee, l_leftAnkle, false);
      leftOk = leftAngle <= 16 && leftAngle >= -7;
    }

    const isNormal = rightOk && leftOk;
    return {
      rightAngle, leftAngle, rightOk, leftOk,
      score: (rightOk ? 0 : -0.3) + (leftOk ? 0 : -0.3),
      disease: isNormal ? 'NORMAL' : PRECISE_DISEASES.FRONT_LEG_UNNORMAL,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 균형패턴2: 좌우 골반 높이 대칭 (좌/우 각 -0.3pt)
  // 오른발 든 구간: Rt hip이 Lt hip보다 2~10° 높아야 정상
  // 왼발  든 구간: Lt hip이 Rt hip보다 2~10° 높아야 정상
  // 판정은 표시 각도(정수 반올림) 기준으로 수행
  // ─────────────────────────────────────────────────────────────
  private checkHip(
    r_raisedHip: Point, r_supportHip: Point,  // 오른발 든 구간 (든 쪽 hip, 지지 쪽 hip)
    l_raisedHip: Point, l_supportHip: Point,  // 왼발  든 구간 (든 쪽 hip, 지지 쪽 hip)
  ) {
    let rightAngle = 0, leftAngle = 0;
    let rightOk = true, leftOk = true;

    if (r_raisedHip && r_supportHip) {
      // y 좌표: 위로 갈수록 작음 → raised hip.y < support hip.y 이면 든 쪽이 높음
      const dx = r_supportHip.x - r_raisedHip.x;
      const dy = r_supportHip.y - r_raisedHip.y; // 양수면 raised hip이 더 위
      rightAngle = Math.atan2(dy, Math.abs(dx)) * (180 / Math.PI);
      const rightJudgeAngle = Math.trunc(rightAngle);
      rightOk = rightJudgeAngle >= BALANCE_ALIGNMENT.FRONT_HIP_NORMAL_MIN_DEG
        && rightJudgeAngle <= BALANCE_ALIGNMENT.FRONT_HIP_NORMAL_MAX_DEG;
    }
    if (l_raisedHip && l_supportHip) {
      const dx = l_supportHip.x - l_raisedHip.x;
      const dy = l_supportHip.y - l_raisedHip.y;
      leftAngle = Math.atan2(dy, Math.abs(dx)) * (180 / Math.PI);
      const leftJudgeAngle = Math.trunc(leftAngle);
      leftOk = leftJudgeAngle >= BALANCE_ALIGNMENT.FRONT_HIP_NORMAL_MIN_DEG
        && leftJudgeAngle <= BALANCE_ALIGNMENT.FRONT_HIP_NORMAL_MAX_DEG;
    }

    const isNormal = rightOk && leftOk;
    return {
      rightAngle, leftAngle, rightOk, leftOk,
      score: (rightOk ? 0 : -0.3) + (leftOk ? 0 : -0.3),
      disease: isNormal ? 'NORMAL' : PRECISE_DISEASES.HIP_UNNORMAL,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 균형패턴1: 상체 좌우 기울기 (-1pt)
  // 양쪽 hip 중앙점 → 양쪽 shoulder 중앙점 선의 수직선 대비 기울기
  // 오른발 든 구간: 오른쪽 0~5°, 왼쪽 0~2° 정상
  // 왼발  든 구간: 왼쪽 0~5°, 오른쪽 0~2° 정상
  // ─────────────────────────────────────────────────────────────
  private checkVerticalBody(
    r_lShoulder: Point, r_lHip: Point, r_rShoulder: Point, r_rHip: Point,  // 오른발 든 구간
    l_lShoulder: Point, l_lHip: Point, l_rShoulder: Point, l_rHip: Point,  // 왼발 든 구간
  ) {
    let rightAngle = 0, leftAngle = 0;
    let rightOk = true, leftOk = true;
    let rightDir: 'right' | 'left' | 'center' = 'center';
    let leftDir: 'right' | 'left' | 'center' = 'center';

    if (r_lShoulder && r_lHip && r_rShoulder && r_rHip) {
      const hipMidX = (r_lHip.x + r_rHip.x) / 2;
      const hipMidY = (r_lHip.y + r_rHip.y) / 2;
      const shouMidX = (r_lShoulder.x + r_rShoulder.x) / 2;
      const shouMidY = (r_lShoulder.y + r_rShoulder.y) / 2;
      // hip→shoulder 수직선 대비 기울기
      const dx = shouMidX - hipMidX;
      const dy = Math.abs(hipMidY - shouMidY);
      rightAngle = Math.atan2(Math.abs(dx), dy) * (180 / Math.PI);
      // 정면 비미러: shoulder가 hip보다 오른쪽(큰 x) → 상체가 오른쪽으로 기울어짐
      rightDir = dx > 0 ? 'right' : dx < 0 ? 'left' : 'center';
      // 오른발 든 구간 정상: 오른쪽 0~5°, 왼쪽 0~2°
      rightOk = rightDir === 'right' ? rightAngle <= 5
              : rightDir === 'left'  ? rightAngle <= 2
              : true;
    }
    if (l_lShoulder && l_lHip && l_rShoulder && l_rHip) {
      const hipMidX = (l_lHip.x + l_rHip.x) / 2;
      const hipMidY = (l_lHip.y + l_rHip.y) / 2;
      const shouMidX = (l_lShoulder.x + l_rShoulder.x) / 2;
      const shouMidY = (l_lShoulder.y + l_rShoulder.y) / 2;
      const dx = shouMidX - hipMidX;
      const dy = Math.abs(hipMidY - shouMidY);
      leftAngle = Math.atan2(Math.abs(dx), dy) * (180 / Math.PI);
      leftDir = dx > 0 ? 'right' : dx < 0 ? 'left' : 'center';
      // 왼발 든 구간 정상: 왼쪽 0~5°, 오른쪽 0~2°
      leftOk = leftDir === 'left'  ? leftAngle <= 5
             : leftDir === 'right' ? leftAngle <= 2
             : true;
    }

    const isNormal = rightOk && leftOk;
    return {
      rightAngle, leftAngle, rightDir, leftDir, rightOk, leftOk,
      score: (rightOk ? 0 : -1) + (leftOk ? 0 : -1),
      disease: isNormal ? 'NORMAL' : PRECISE_DISEASES.VERTICAL_BODY_UNNORMAL,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 균형패턴3: 지지 다리 정렬 (좌/우 각 -2pt)
  // Axis_A = 든 다리 무릎 수직선, Angle_HKA = hip·knee·ankle 무릎 내각
  // ─────────────────────────────────────────────────────────────
  private checkHorizontalBody(
    r_axisKnee: Point, r_supportHip: Point, r_supportKnee: Point, r_supportAnkle: Point,
    l_axisKnee: Point, l_supportHip: Point, l_supportKnee: Point, l_supportAnkle: Point,
  ) {
    let rightAngle = 0;
    let leftAngle = 0;
    let rightDistKnee = 0;
    let rightDistAnkle = 0;
    let leftDistKnee = 0;
    let leftDistAnkle = 0;
    let rightStatus: string = '바른정렬';
    let leftStatus: string = '바른정렬';
    let rightOk = true;
    let leftOk = true;

    if (r_axisKnee && r_supportHip && r_supportKnee && r_supportAnkle) {
      const result = resolveSupportingLegAlignment(
        r_axisKnee,
        r_supportHip,
        r_supportKnee,
        r_supportAnkle,
        true,
      );
      rightAngle = result.angleHka;
      rightDistKnee = result.distKnee;
      rightDistAnkle = result.distAnkle;
      rightStatus = result.status;
      rightOk = result.status === '바른정렬';
    }
    if (l_axisKnee && l_supportHip && l_supportKnee && l_supportAnkle) {
      const result = resolveSupportingLegAlignment(
        l_axisKnee,
        l_supportHip,
        l_supportKnee,
        l_supportAnkle,
        false,
      );
      leftAngle = result.angleHka;
      leftDistKnee = result.distKnee;
      leftDistAnkle = result.distAnkle;
      leftStatus = result.status;
      leftOk = result.status === '바른정렬';
    }

    const isNormal = rightOk && leftOk;
    return {
      rightAngle,
      leftAngle,
      rightDistKnee,
      rightDistAnkle,
      leftDistKnee,
      leftDistAnkle,
      rightStatus,
      leftStatus,
      rightOk,
      leftOk,
      score: (rightOk ? 0 : -2) + (leftOk ? 0 : -2),
      disease: isNormal ? 'NORMAL' : PRECISE_DISEASES.HORIZONTAL_BODY_UNNORMAL,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 균형패턴4: 상체 전후 기울기 (좌/우 각 -0.7pt)
  // 랜드마크: shoulder, hip (측면)
  // 우측면: Rt shoulder–Rt hip 기울기 -4° ~ -17° 정상
  // 좌측면: Lt shoulder–Lt hip 기울기 -4° ~ -17° 정상
  // 기울기 정의: shoulder→hip 방향, 수평선 대비 부호 있는 각도
  //   음수 = shoulder가 hip보다 뒤쪽(backward lean) — 정상 범위
  // ─────────────────────────────────────────────────────────────
  private checkHead(
    r_shoulder: Point, r_hip: Point,  // 우측면: 오른발 든 구간
    l_shoulder: Point, l_hip: Point,  // 좌측면: 왼발 든 구간
  ) {
    let rightAngle = 0, leftAngle = 0;
    let rightOk = true, leftOk = true;

    if (r_shoulder && r_hip) {
      // 우측면: 피검자가 오른쪽을 향함 → 앞으로 수그리면 shoulder.x > hip.x → dx(hip-shoulder) < 0 → 부호 반전 필요
      rightAngle = -this.signedAngleFromHorizontal(r_shoulder, r_hip);
      rightOk = rightAngle >= -17 && rightAngle <= -4;
    }
    if (l_shoulder && l_hip) {
      // 좌측면: 피검자가 왼쪽을 향함 → 앞으로 수그리면 shoulder.x < hip.x → dx(hip-shoulder) > 0 → 부호 그대로
      leftAngle = this.signedAngleFromHorizontal(l_shoulder, l_hip);
      leftOk = leftAngle >= -17 && leftAngle <= -4;
    }

    const isNormal = rightOk && leftOk;
    return {
      rightAngle, leftAngle, rightOk, leftOk,
      score: (rightOk ? 0 : -0.7) + (leftOk ? 0 : -0.7),
      disease: isNormal ? 'NORMAL' : PRECISE_DISEASES.HEAD_UNNORMAL,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 균형패턴5: 든 다리 엉덩관절 높이 (좌/우 각 -0.7pt)
  // 랜드마크: hip, knee (측면)
  // hip–knee 연결선이 수평선(0°) 대비 -11° ~ +6° 정상
  //   양수 = knee가 hip보다 위 / 음수 = knee가 hip보다 아래
  // ─────────────────────────────────────────────────────────────
  private checkSideLeg(
    r_hip: Point, r_knee: Point,  // 우측면: 오른발 든 구간
    l_hip: Point, l_knee: Point,  // 좌측면: 왼발 든 구간
  ) {
    let rightAngle = 0, leftAngle = 0;
    let rightOk = true, leftOk = true;

    if (r_hip && r_knee) {
      rightAngle = this.hipKneeAngle(r_hip, r_knee);
      rightOk = rightAngle >= -11 && rightAngle <= 6;
    }
    if (l_hip && l_knee) {
      leftAngle = this.hipKneeAngle(l_hip, l_knee);
      leftOk = leftAngle >= -11 && leftAngle <= 6;
    }

    const isNormal = rightOk && leftOk;
    return {
      rightAngle, leftAngle, rightOk, leftOk,
      score: (rightOk ? 0 : -0.7) + (leftOk ? 0 : -0.7),
      disease: isNormal ? 'NORMAL' : PRECISE_DISEASES.SIDE_LEG_UNNORMAL,
    };
  }
}
