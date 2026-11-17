import { PRECISE_DISEASES } from '../../../common/enums/precise-diseases.enum';
import { AnalyticResult } from './analytic.result';
import { AnalyticStrategy } from './analytic.strategy';
import { DiseaseResult, Landmarks, Point } from '../analysis.types';
import { SPINAL_ALIGNMENT } from '../analysis.constants';
import { computePelvicReactionFromHips } from '../helpers/pelvic-reaction.helper';

export class SpinalAlignmentTestStrategy implements AnalyticStrategy {
  // 임계값은 analysis.constants.ts SPINAL_ALIGNMENT 참조
  async execute(landmarks: Landmarks): Promise<AnalyticResult> {
    const disease: DiseaseResult[] = [];

    if (!landmarks.back) {
      return new AnalyticResult(0, {}, []);
    }

    const back = landmarks.back;
    const hasAnkles = back.LeftAnkle && back.RightAnkle;

    const scoreDetail = {
      centerShoulderHip: this.checkCenterShoulderHip(
        back.LeftShoulder,
        back.RightShoulder,
        back.LeftHip,
        back.RightHip,
      ),
      higherShoulder: this.checkHigherShoulder(
        back.LeftShoulder,
        back.RightShoulder,
      ),
      pelvicReaction: this.checkPelvicReaction(
        back.LeftHip,
        back.RightHip,
      ),
      legUsage: hasAnkles
        ? this.checkLegUsage(
            back.LeftAnkle,
            back.RightAnkle,
            back.LeftHip,
            back.RightHip,
          )
        : null,
      /**
       * 등·어깨 윤곽 도드라짐 (굽힘 자세 x축 편차)
       * hipMidX = (leftHip.x + rightHip.x) / 2
       * rightOffset = rightShoulder.x - hipMidX   (양수 = 오른쪽으로 벗어남)
       * leftOffset  = hipMidX - leftShoulder.x    (양수 = 왼쪽으로 벗어남)
       * diff = rightOffset - leftOffset
       *   diff > threshold  → 오른쪽 윤곽 도드라짐
       *   diff < -threshold → 왼쪽 윤곽 도드라짐
       *   else              → 양측 유사
       */
      shoulderContour: this.checkShoulderContour(
        back.LeftShoulder,
        back.RightShoulder,
        back.LeftHip,
        back.RightHip,
      ),
    };

    Object.values({ centerShoulderHip: scoreDetail.centerShoulderHip, higherShoulder: scoreDetail.higherShoulder }).forEach(detail => {
      if (detail.disease !== 'NORMAL') {
        disease.push({
          key: detail.disease,
          level: '',
          score: 0,
        });
      }
    });

    return new AnalyticResult(0, scoreDetail, disease);
  }

  private checkCenterShoulderHip(
    leftShoulder: Point,
    rightShoulder: Point,
    leftHip: Point,
    rightHip: Point,
  ) {
    const centerShoulderX = (leftShoulder.x + rightShoulder.x) / 2;
    const centerHipX = (leftHip.x + rightHip.x) / 2;

    return {
      result: centerShoulderX - centerHipX,
      score: 0,
      disease:
        Math.abs(centerShoulderX - centerHipX) <= SPINAL_ALIGNMENT.TILT_THRESHOLD_PX
          ? 'NORMAL'
          : centerShoulderX > centerHipX
          ? PRECISE_DISEASES.SPINE_TILTED_RIGHT
          : PRECISE_DISEASES.SPINE_TILTED_LEFT,
    };
  }
  private checkHigherShoulder(leftShoulder: Point, rightShoulder: Point) {
    return {
      result: leftShoulder.y - rightShoulder.y,
      score: 0,
      disease:
        Math.abs(leftShoulder.y - rightShoulder.y) <= SPINAL_ALIGNMENT.SHOULDER_HEIGHT_THRESHOLD_PX
          ? 'NORMAL'
          : rightShoulder.y < leftShoulder.y
          ? PRECISE_DISEASES.SPINE_CURVED_RIGHT
          : PRECISE_DISEASES.SPINE_CURVED_LEFT,
    };
  }

  /**
   * 등·어깨 윤곽 도드라짐 (굽힘 자세 x축 편차)
   * hipMidX = (leftHip.x + rightHip.x) / 2
   * rightOffset = rightShoulder.x - hipMidX   (양수 = 오른쪽으로 벗어남)
   * leftOffset  = hipMidX - leftShoulder.x    (양수 = 왼쪽으로 벗어남)
   * diff = rightOffset - leftOffset
   *   diff > threshold  → 오른쪽 윤곽 도드라짐
   *   diff < -threshold → 왼쪽 윤곽 도드라짐
   *   else              → 양측 유사
   */
  private checkShoulderContour(
    leftShoulder: Point,
    rightShoulder: Point,
    leftHip: Point,
    rightHip: Point,
  ) {
    const hipMidX = (leftHip.x + rightHip.x) / 2;
    const rightOffset = rightShoulder.x - hipMidX;
    const leftOffset  = hipMidX - leftShoulder.x;
    const diff = rightOffset - leftOffset;
    // 후면 촬영: 인체 오른쪽 = 화면 오른쪽 = 큰 X
    // diff > 0 → rightOffset 큼 → 오른쪽 어깨/등 윤곽 도드라짐
    const dominantSide: '오른쪽' | '왼쪽' | '균형' =
      diff > SPINAL_ALIGNMENT.CONTOUR_THRESHOLD_PX ? '오른쪽'
      : diff < -SPINAL_ALIGNMENT.CONTOUR_THRESHOLD_PX ? '왼쪽'
      : '균형';
    return { rightOffset, leftOffset, diff, dominantSide, score: 0 };
  }

  private checkPelvicReaction(leftHip: Point, rightHip: Point) {
    return computePelvicReactionFromHips(leftHip, rightHip);
  }

  /**
   * 다리 사용 측정 (문서 명세 기반 X좌표 비교 방식)
   * 측정 기준선: 양쪽 ankle(heel) 중심점 ↔ 양쪽 hip 중심점
   *
   * 후면 촬영 좌표 규약: 인체 오른쪽 = 화면 오른쪽 = 큰 X
   * dx = hipMidX - heelMidX
   *   dx > 0 → hip이 heel보다 인체 오른쪽에 위치 → 오른쪽 다리 사용 비중 높음
   *   dx < 0 → hip이 heel보다 인체 왼쪽에 위치  → 왼쪽 다리 사용 비중 높음
   */
  private checkLegUsage(
    leftAnkle: Point,
    rightAnkle: Point,
    leftHip: Point,
    rightHip: Point,
  ) {
    const heelMidX = (leftAnkle.x + rightAnkle.x) / 2;
    const hipMidX  = (leftHip.x  + rightHip.x)  / 2;
    const dx = hipMidX - heelMidX;

    const dominantSide: '오른쪽' | '왼쪽' | '균형' =
      Math.abs(dx) < SPINAL_ALIGNMENT.LEG_USAGE_THRESHOLD_PX ? '균형'
      : dx > 0 ? '오른쪽'
      : '왼쪽';

    return { heelMidX, hipMidX, dx, dominantSide, score: 0 };
  }
}
