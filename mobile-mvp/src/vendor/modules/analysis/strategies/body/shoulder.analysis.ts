import { BODY_DISEASES } from '../../../../common/enums/body-diseases.enum';
import { calculateAngle } from '../../helpers/angle.helper';
import {
  getLevel,
  getResponseForOneResult,
  getResponseForTwoResult,
} from '../../helpers/body-response.helper';
import { calculateDistance } from '../../helpers/distance.helper';
import { minScoreUsage } from '../../helpers/body-score-usage.helper';
import { PartAnalysis } from './part.analysis';
import { AnalysisResponse, DiseaseResult, Landmarks, Point, ScoreDetail, ScoreMap } from '../../analysis.types';

export class ShoulderAnalysis implements PartAnalysis {
  score = 0;
  disease: DiseaseResult[] = [];
  scoreDetail: ScoreDetail = {};

  execute(landmarks: Landmarks, scoreDetail: ScoreDetail): any {
    this.disease = [];
    this.scoreDetail = scoreDetail;

    const { front, right_side } = landmarks;
    if (!front?.LeftEar || !front?.LeftShoulder || !front?.LeftHip || !front?.RightEar || !front?.RightShoulder || !front?.RightHip) {
      return { raisedDroppedShoulder: {}, shoulderHeightAsymmetry: {}, roundedShoulder: {}, shoulderPosition: {} };
    }

    const raisedDroppedShoulder = this.checkRaisedOrDroppedShoulder(
      front.LeftEar,
      front.LeftShoulder,
      front.LeftHip,
      front.RightEar,
      front.RightShoulder,
      front.RightHip,
    );
    const shoulderHeightAsymmetry = this.checkShoulderAsymmetry(
      front.LeftShoulder,
      front.RightShoulder,
    );
    const roundedOrStraightShoulder = this.checkRoundedOrStraightShoulder();
    const shoulderPosition = (right_side?.RightShoulder && right_side?.RightAnkle)
      ? this.checkShoulderPosition(right_side.RightShoulder, right_side.RightAnkle)
      : { max: '', score: 5, scoreUsage: 100, disease: 'NORMAL', result: '', scoreMapping: [] };

    const neckTurtleScore = scoreDetail.neck?.neckTurtleRaised?.scoreUsage ?? 100;
    this.score = minScoreUsage([shoulderHeightAsymmetry.scoreUsage, neckTurtleScore]);
    return {
      raisedDroppedShoulder: raisedDroppedShoulder,
      shoulderHeightAsymmetry: shoulderHeightAsymmetry,
      roundedShoulder: roundedOrStraightShoulder,
      shoulderPosition: shoulderPosition,
    };
  }

  private checkRoundedOrStraightShoulder(): AnalysisResponse {
    if (
      this.scoreDetail.back?.backHunchedOrFlat?.disease ==
      BODY_DISEASES.HUNCHED_BACK
    ) {
      const response = { ...this.scoreDetail.back.backHunchedOrFlat };
      response.disease = BODY_DISEASES.ROUNDED_SHOULDER;
      response.scoreUsage = 100;
      this.disease.push({
        key: response.disease,
        level: getLevel(response.score),
        score: response.score,
      });
      return response;
    }
    if (
      this.scoreDetail.back?.backHunchedOrFlat?.disease == BODY_DISEASES.FLAT_BACK
    ) {
      const response = { ...this.scoreDetail.back.backHunchedOrFlat };
      response.disease = BODY_DISEASES.STRAIGHT_SHOULDER;
      response.scoreUsage = 100;
      this.disease.push({
        key: response.disease,
        level: getLevel(response.score),
        score: response.score,
      });
      return response;
    }
    return {
      max: '0.5',
      score: 5,
      scoreUsage: 100,
      disease: 'NORMAL',
      result: '0.5',
      scoreMapping: [],
    };
  }

  private checkRaisedOrDroppedShoulder(
    leftEar: Point,
    leftShoulder: Point,
    leftHip: Point,
    rightEar: Point,
    rightShoulder: Point,
    rightHip: Point,
  ): AnalysisResponse {
    const AB = calculateDistance(leftEar, leftShoulder);
    const BE = calculateDistance(leftShoulder, leftHip);
    const CD = calculateDistance(rightEar, rightShoulder);
    const DF = calculateDistance(rightShoulder, rightHip);
    const scoreMapping: ScoreMap[] = [
      { max: 0.29, score: 62, scoreUsage: 30, disease: BODY_DISEASES.RAISED_SHOULDER },
      { max: 0.34, score: 55, scoreUsage: 50, disease: BODY_DISEASES.RAISED_SHOULDER },
      { max: 0.39, score: 40, scoreUsage: 60, disease: BODY_DISEASES.RAISED_SHOULDER },
      { max: 0.44, score: 25, scoreUsage: 70, disease: BODY_DISEASES.RAISED_SHOULDER },
      { max: 0.49, score: 15, scoreUsage: 80, disease: BODY_DISEASES.RAISED_SHOULDER },
      { max: 0.5, score: 5, scoreUsage: 100, disease: 'NORMAL' },
      { max: 0.55, score: 15, scoreUsage: 80, disease: BODY_DISEASES.DROPPED_SHOULDER },
      { max: 0.6, score: 25, scoreUsage: 70, disease: BODY_DISEASES.DROPPED_SHOULDER },
      { max: 0.65, score: 40, scoreUsage: 60, disease: BODY_DISEASES.DROPPED_SHOULDER },
      { max: 0.7, score: 55, scoreUsage: 50, disease: BODY_DISEASES.DROPPED_SHOULDER },
      { max: Infinity, score: 62, scoreUsage: 30, disease: BODY_DISEASES.DROPPED_SHOULDER },
    ];
    const leftPercent = Math.round((AB / BE) * 100) / 100;
    const rightPercent = Math.round((CD / DF) * 100) / 100;

    const defaultResult: ScoreMap = { max: Infinity, score: 5, scoreUsage: 100, disease: 'NORMAL' };
    const result1 = scoreMapping.find((item) => leftPercent <= item.max) || defaultResult;
    const result2 = scoreMapping.find((item) => rightPercent <= item.max) || defaultResult;

    if (
      (leftPercent == 0.5 && rightPercent == 0.5) ||
      (result1.disease === result2.disease && result1.disease !== 'NORMAL') ||
      (result1.disease === BODY_DISEASES.RAISED_SHOULDER &&
        result2.disease === BODY_DISEASES.DROPPED_SHOULDER) ||
      (result1.disease === BODY_DISEASES.DROPPED_SHOULDER &&
        result2.disease === BODY_DISEASES.RAISED_SHOULDER)
    ) {
      //normal
      return {
        max: '0.5',
        score: 5,
        scoreUsage: 100,
        disease: 'NORMAL',
        result: '양호한:양호한',
        scoreMapping: [],
      };
    }
    const { response, disease } = getResponseForTwoResult(
      leftPercent,
      result1,
      rightPercent,
      result2,
      scoreMapping,
    );

    const getStatus = (disease: string) => {
      if (disease === BODY_DISEASES.RAISED_SHOULDER) return '올라간';
      if (disease === BODY_DISEASES.DROPPED_SHOULDER) return '처진';
      return '양호한';
    }

    const leftStatus = getStatus(result1.disease);
    const rightStatus = getStatus(result2.disease);

    response.result = `${leftStatus}:${rightStatus}`;

    response.scoreUsage = 100;
    if (disease.length > 0) {
      this.disease = this.disease.concat(disease);
    }
    return response;
  }

  private checkShoulderAsymmetry(leftShoulder: Point, rightShoulder: Point): AnalysisResponse {
    const dy = rightShoulder.y - leftShoulder.y;
    const dx = rightShoulder.x - leftShoulder.x;
    const tiltDeg = Math.atan2(Math.abs(dy), Math.abs(dx)) * (180 / Math.PI);

    let status = '동일한';
    if (Math.round(tiltDeg) >= 1) {
      status = dy > 0 ? '낮은' : '높은';
    }

    const scoreMapping: ScoreMap[] = [
      { max: 1, score: 5, scoreUsage: 100, disease: 'NORMAL' },
      { max: 1.6, score: 15, scoreUsage: 80, disease: BODY_DISEASES.SHOULDER_HEIGHT_ASYMMETRY },
      { max: 2.8, score: 25, scoreUsage: 70, disease: BODY_DISEASES.SHOULDER_HEIGHT_ASYMMETRY },
      { max: 4, score: 40, scoreUsage: 60, disease: BODY_DISEASES.SHOULDER_HEIGHT_ASYMMETRY },
      { max: 6, score: 55, scoreUsage: 50, disease: BODY_DISEASES.SHOULDER_HEIGHT_ASYMMETRY },
      { max: Infinity, score: 62, scoreUsage: 30, disease: BODY_DISEASES.SHOULDER_HEIGHT_ASYMMETRY },
    ];

    const defaultResult: ScoreMap = { max: Infinity, score: 5, scoreUsage: 100, disease: 'NORMAL' };
    const result = scoreMapping.find((item) => tiltDeg <= item.max) || defaultResult;

    const { response, disease } = getResponseForOneResult(
      tiltDeg,
      result,
      scoreMapping,
    );

    response.result = `${status}:${tiltDeg.toFixed(1)}`;

    if (disease.length > 0) {
      this.disease = this.disease.concat(disease);
    }
    return response;
  }

  // AS-IS 복원: 측면 어깨 위치 (RightShoulder.x vs RightAnkle.x)
  // distance = RightShoulder.x - RightAnkle.x (px)
  // > 0 → 앞쪽, < 0 → 뒤쪽, ~0 → 같은 수직선상
  private checkShoulderPosition(rightShoulder: Point, rightAnkle: Point): AnalysisResponse {
    const diff = rightShoulder.x - rightAnkle.x;
    const distance = Math.abs(diff);
    const position = diff > 1 ? '앞쪽' : diff < -1 ? '뒤쪽' : '같은 수직선상';

    return {
      max: '',
      score: 5,
      scoreUsage: 100,
      disease: 'NORMAL',
      result: JSON.stringify({ position, distance: distance.toFixed(1) }),
      scoreMapping: [],
    };
  }
}
