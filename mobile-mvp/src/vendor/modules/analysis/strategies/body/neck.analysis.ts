import { BODY_DISEASES } from '../../../../common/enums/body-diseases.enum';
import { calculateAngle } from '../../helpers/angle.helper';
import {
  getLevel,
  getResponseForOneResult,
} from '../../helpers/body-response.helper';
import { calculateDistance } from '../../helpers/distance.helper';
import { minScoreUsage } from '../../helpers/body-score-usage.helper';
import { PartAnalysis } from './part.analysis';
import { AnalysisResponse, DiseaseResult, Landmarks, Point, ScoreDetail, ScoreMap } from '../../analysis.types';

export class NeckAnalysis implements PartAnalysis {
  score = 0;
  disease: DiseaseResult[] = [];
  scoreDetail: ScoreDetail = {};

  public execute(landmarks: Landmarks, scoreDetail: ScoreDetail): any {
    this.disease = [];
    this.scoreDetail = scoreDetail;

    const { front, right_side } = landmarks;
    if (!front?.LeftEar || !front?.LeftShoulder || !front?.RightEar || !front?.RightShoulder || !front?.Nose ||
        !right_side?.RightEar || !right_side?.RightShoulder) {
      return { neckTilt: {}, neckRotation: {}, neckTurtleRaised: {}, straightNeck: {} };
    }

    const neckTilt = this.checkNeckTilt(
      front.LeftEar,
      front.LeftShoulder,
      front.RightEar,
      front.RightShoulder,
    );
    const neckRotation = this.checkNeckRotation(
      front.LeftEar,
      front.RightEar,
      front.Nose,
    );
    const neckTurtleRaised = this.checkNeckTurtleOrRaised(
      right_side.RightEar,
      right_side.RightShoulder,
    );
    const straightNeck = this.checkStraightNeck(neckTurtleRaised);
    this.score = minScoreUsage([neckTilt.scoreUsage, neckTurtleRaised.scoreUsage]);
    return {
      neckTilt: neckTilt,
      neckRotation: neckRotation,
      neckTurtleRaised: neckTurtleRaised,
      straightNeck: straightNeck,
    };
  }

  private checkNeckTilt(leftEar: Point, leftShoulder: Point, rightEar: Point, rightShoulder: Point): AnalysisResponse {
    // 수평선 기준 귀 기울기 (atan2 사용, 어깨 비대칭과 동일 방식)
    const dy = rightEar.y - leftEar.y;
    const dx = rightEar.x - leftEar.x;
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = angleRad * (180 / Math.PI);

    const tiltAngle = Math.abs(angleDeg);

    // angleDeg > 0 → dy > 0 → 오른쪽 귀가 낮음 → 목이 오른쪽으로 가쪽굽힘
    // angleDeg < 0 → dy < 0 → 오른쪽 귀가 높음 → 목이 왼쪽으로 가쪽굽힘
    const THRESHOLD = 1;
    let status: string;
    if (angleDeg > THRESHOLD) {
      status = '오른쪽';
    } else if (angleDeg < -THRESHOLD) {
      status = '왼쪽';
    } else {
      status = '중앙';
    }

    const scoreMapping: ScoreMap[] = [
      { max: 1.4, score: 5, scoreUsage: 100, disease: 'NORMAL' },
      { max: 1.8, score: 15, scoreUsage: 80, disease: BODY_DISEASES.NECK_TILT },
      { max: 2.4, score: 25, scoreUsage: 70, disease: BODY_DISEASES.NECK_TILT },
      { max: 3.0, score: 40, scoreUsage: 60, disease: BODY_DISEASES.NECK_TILT },
      { max: 3.8, score: 55, scoreUsage: 50, disease: BODY_DISEASES.NECK_TILT },
      { max: Infinity, score: 62, scoreUsage: 30, disease: BODY_DISEASES.NECK_TILT },
    ];

    const defaultResult: ScoreMap = { max: Infinity, score: 5, scoreUsage: 100, disease: 'NORMAL' };
    // 점수 매핑은 보정 각도 기준 (표시 시 service에서 보정)
    const fixedTiltAngle = tiltAngle > 90 ? 180 - tiltAngle : tiltAngle;
    const result = scoreMapping.find((item) => fixedTiltAngle <= item.max) || defaultResult;

    const { response, disease } = getResponseForOneResult(
      `${status}:${tiltAngle.toFixed(1)}`,
      result,
      scoreMapping,
    );

    if (disease.length > 0) {
      this.disease = this.disease.concat(disease);
    }
    return response;
  }

  private checkNeckRotation(leftEar: Point, rightEar: Point, nose: Point): AnalysisResponse {
    const AB = calculateDistance(leftEar, nose);
    const BC = calculateDistance(nose, rightEar);
    const percent = Math.round(Math.abs((AB - BC) / ((AB + BC) / 2)) * 100) / 100;

    // percent → 각도 변환: asin(percent) * 180/PI (percent=0.25 → ~14.5°)
    const rotAngle = Math.asin(Math.min(percent, 1)) * (180 / Math.PI);

    // AB > BC → 왼쪽 귀가 코에서 더 멀리 → 얼굴이 오른쪽으로 회전
    const THRESHOLD = 0.05;
    let direction: string;
    if (percent > THRESHOLD) {
      direction = AB > BC ? '오른쪽' : '왼쪽';
    } else {
      direction = '중앙';
    }

    const scoreMapping: ScoreMap[] = [
      { max: 3, score: 5, scoreUsage: 100, disease: 'NORMAL' },
      { max: 6, score: 15, scoreUsage: 80, disease: BODY_DISEASES.NECK_ROTATION },
      { max: 9, score: 25, scoreUsage: 70, disease: BODY_DISEASES.NECK_ROTATION },
      { max: 12, score: 40, scoreUsage: 60, disease: BODY_DISEASES.NECK_ROTATION },
      { max: 15, score: 55, scoreUsage: 50, disease: BODY_DISEASES.NECK_ROTATION },
      { max: Infinity, score: 62, scoreUsage: 30, disease: BODY_DISEASES.NECK_ROTATION },
    ];

    const defaultResult: ScoreMap = { max: Infinity, score: 5, scoreUsage: 100, disease: 'NORMAL' };
    const result = scoreMapping.find((item) => rotAngle <= item.max) || defaultResult;

    const { response, disease } = getResponseForOneResult(
      `${direction}:${rotAngle.toFixed(1)}`,
      result,
      scoreMapping,
    );
    response.scoreUsage = 100;

    if (disease.length > 0) {
      this.disease = this.disease.concat(disease);
    }
    return response;
  }

  private checkNeckTurtleOrRaised(rightEar: Point, rightShoulder: Point): AnalysisResponse {
    const { x: x1 } = rightEar;
    const { x: x2 } = rightShoulder;
    const angle = calculateAngle(rightEar, rightShoulder, { x: x2, y: 0 });

    const scoreMapping: ScoreMap[] = [
      { max: 176.5, score: 5, scoreUsage: 100, disease: 'NORMAL' },
      { max: 173, score: 15, scoreUsage: 80, disease: '' },
      { max: 167.7, score: 25, scoreUsage: 70, disease: '' },
      { max: 162.5, score: 40, scoreUsage: 60, disease: '' },
      { max: 155.5, score: 55, scoreUsage: 50, disease: '' },
      { max: 0, score: 62, scoreUsage: 30, disease: '' },
    ];

    const result = scoreMapping.find((item) => angle >= item.max);
    const defaultResult: ScoreMap = { max: 0, score: 62, scoreUsage: 30, disease: '' };
    const matched = result || defaultResult;

    if (!matched.disease) {
      matched.disease = 'NORMAL';
      if (x1 > x2) {
        matched.disease = BODY_DISEASES.TURTLE_NECK;
      } else if (x1 < x2) {
        matched.disease = BODY_DISEASES.RAISED_NECK;
      }
    }

    const { response, disease } = getResponseForOneResult(
      angle,
      matched,
      scoreMapping,
    );

    if (disease.length > 0) {
      this.disease = this.disease.concat(disease);
    }
    return response;
  }

  private checkStraightNeck(neckTurtleRaised: AnalysisResponse): AnalysisResponse {
    if (neckTurtleRaised.disease != 'NORMAL') {
      const response = { ...neckTurtleRaised };
      response.disease = BODY_DISEASES.STRAIGHT_NECK;
      response.scoreUsage = 100;
      this.disease.push({
        key: response.disease,
        level: getLevel(response.score),
        score: response.score,
      });
      return response;
    }
    return {
      max: '',
      score: 5,
      scoreUsage: 100,
      disease: 'NORMAL',
      result: '',
      scoreMapping: [],
    };
  }
}
