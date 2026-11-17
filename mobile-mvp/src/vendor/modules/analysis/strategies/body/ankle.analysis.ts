import { BODY_DISEASES } from '../../../../common/enums/body-diseases.enum';
import { calculateAngle } from '../../helpers/angle.helper';
import { scoreUsageFromAnkleRotationAngle } from '../../helpers/body-score-usage.helper';
import { getLevel, getResponseForTwoResult } from '../../helpers/body-response.helper';
import { PartAnalysis } from './part.analysis';
import { AnalysisResponse, DiseaseResult, Landmarks, Point, ScoreDetail, ScoreMap } from '../../analysis.types';

export class AnkleAnalysis implements PartAnalysis {
  score = 0;
  disease: DiseaseResult[] = [];
  scoreDetail: ScoreDetail = {};

  execute(landmarks: Landmarks, scoreDetail: ScoreDetail): any {
    this.disease = [];
    this.scoreDetail = scoreDetail;

    const { front, back } = landmarks;

    if (!front?.LeftAnkle || !front?.LeftToe || !front?.RightAnkle || !front?.RightToe ||
        !back?.LeftAnkle || !back?.LeftHeel || !back?.RightAnkle || !back?.RightHeel) {
      return { ankleMove: {}, feetFlatOrArched: {} };
    }

    const ankleMove = this.checkAnkleMove(
      front.LeftAnkle,
      front.LeftToe,
      front.RightAnkle,
      front.RightToe,
    );
    const feetFlatOrArched = this.checkFeetFlatOrArched(
      back.LeftAnkle,
      back.LeftHeel,
      back.RightAnkle,
      back.RightHeel,
    );
    this.score = ankleMove.scoreUsage;
    return {
      ankleMove: ankleMove,
      feetFlatOrArched: feetFlatOrArched,
    };
  }

  private checkAnkleMove(leftAnkle: Point, leftFootIndex: Point, rightAnkle: Point, rightFootIndex: Point): AnalysisResponse {
    const r1 = calculateAngle(leftAnkle, rightAnkle, leftFootIndex);
    const r2 = calculateAngle(rightAnkle, leftAnkle, rightFootIndex);

    const scoreUsage1 = scoreUsageFromAnkleRotationAngle(r1);
    const scoreUsage2 = scoreUsageFromAnkleRotationAngle(r2);
    const scoreUsage = Math.min(scoreUsage1, scoreUsage2);

    const getDisease = (angle: number): string => {
      if (angle >= 85 && angle <= 95) return 'NORMAL';
      if (angle > 95) return BODY_DISEASES.ANKLE_MOVE_OUTWARD;
      return BODY_DISEASES.ANKLE_MOVE_INWARD;
    };

    const disease1 = getDisease(r1);
    const disease2 = getDisease(r2);

    const result1: ScoreMap = {
      max: r1,
      score: scoreUsage1 <= 30 ? 62 : scoreUsage1 <= 50 ? 55 : scoreUsage1 <= 60 ? 40 : scoreUsage1 <= 70 ? 25 : scoreUsage1 <= 80 ? 15 : 5,
      scoreUsage: scoreUsage1,
      disease: disease1,
    };
    const result2: ScoreMap = {
      max: r2,
      score: scoreUsage2 <= 30 ? 62 : scoreUsage2 <= 50 ? 55 : scoreUsage2 <= 60 ? 40 : scoreUsage2 <= 70 ? 25 : scoreUsage2 <= 80 ? 15 : 5,
      scoreUsage: scoreUsage2,
      disease: disease2,
    };

    const { response, disease } = getResponseForTwoResult(r1, result1, r2, result2, []);
    response.scoreUsage = scoreUsage;

    if (disease.length > 0) {
      this.disease = this.disease.concat(disease);
    } else if (disease1 !== 'NORMAL' || disease2 !== 'NORMAL') {
      const worstDisease = scoreUsage1 <= scoreUsage2 ? disease1 : disease2;
      if (worstDisease !== 'NORMAL') {
        this.disease.push({
          key: worstDisease,
          level: getLevel(response.score),
          score: response.score,
        });
      }
    }
    return response;
  }

  private checkFeetFlatOrArched(leftAnkle: Point, leftHeel: Point, rightAnkle: Point, rightHeel: Point): AnalysisResponse {
    const scoreMapping: ScoreMap[] = [
      { max: 111, score: 62, scoreUsage: 30, disease: BODY_DISEASES.ARCHED_FEET },
      { max: 106, score: 55, scoreUsage: 50, disease: BODY_DISEASES.ARCHED_FEET },
      { max: 101, score: 40, scoreUsage: 60, disease: BODY_DISEASES.ARCHED_FEET },
      { max: 96, score: 25, scoreUsage: 70, disease: BODY_DISEASES.ARCHED_FEET },
      { max: 91, score: 15, scoreUsage: 80, disease: BODY_DISEASES.ARCHED_FEET },
      { max: 90, score: 5, scoreUsage: 100, disease: 'NORMAL' },
      { max: 85, score: 15, scoreUsage: 80, disease: BODY_DISEASES.FLAT_FEET },
      { max: 80, score: 25, scoreUsage: 70, disease: BODY_DISEASES.FLAT_FEET },
      { max: 75, score: 40, scoreUsage: 60, disease: BODY_DISEASES.FLAT_FEET },
      { max: 70, score: 55, scoreUsage: 50, disease: BODY_DISEASES.FLAT_FEET },
      { max: 0, score: 62, scoreUsage: 30, disease: BODY_DISEASES.FLAT_FEET },
    ];
    const r1 = calculateAngle(leftHeel, leftAnkle, rightHeel);
    const r2 = calculateAngle(rightHeel, leftHeel, rightAnkle);

    const defaultResult: ScoreMap = { max: Infinity, score: 5, scoreUsage: 100, disease: 'NORMAL' };
    const result1 = scoreMapping.find((item) => r1 >= item.max) || defaultResult;
    const result2 = scoreMapping.find((item) => r2 >= item.max) || defaultResult;

    const { response, disease } = getResponseForTwoResult(
      r1,
      result1,
      r2,
      result2,
      scoreMapping,
    );
    response.scoreUsage = 100;
    if (disease.length > 0) {
      this.disease = this.disease.concat(disease);
    }
    return response;
  }
}
