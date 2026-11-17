import { BODY_DISEASES } from '../../../../common/enums/body-diseases.enum';
import { calculateKneeAngle180Plus } from '../../helpers/angle.helper';
import { scoreUsageFromKneeAngle } from '../../helpers/body-score-usage.helper';
import { getLevel, getResponseForTwoResult } from '../../helpers/body-response.helper';
import { PartAnalysis } from './part.analysis';
import { AnalysisResponse, DiseaseResult, Landmarks, Point, ScoreDetail, ScoreMap } from '../../analysis.types';

export class KneeAnalysis implements PartAnalysis {
  score = 0;
  disease: DiseaseResult[] = [];
  scoreDetail: ScoreDetail = {};

  execute(landmarks: Landmarks, scoreDetail: ScoreDetail): any {
    this.disease = [];
    this.scoreDetail = scoreDetail;

    const { left_side, right_side } = landmarks;
    const leftSideData = left_side || right_side;
    if (!leftSideData?.LeftHip || !leftSideData?.LeftKnee || !leftSideData?.LeftAnkle ||
        !right_side?.RightHip || !right_side?.RightKnee || !right_side?.RightAnkle) {
      return { kneesBentOrBack: {} };
    }

    const kneesBentOrBack = this.checkKneesBentOrBack(
      leftSideData.LeftHip,
      leftSideData.LeftKnee,
      leftSideData.LeftAnkle,
      right_side.RightHip,
      right_side.RightKnee,
      right_side.RightAnkle,
    );
    this.score = kneesBentOrBack.scoreUsage;
    return { kneesBentOrBack: kneesBentOrBack };
  }

  private checkKneesBentOrBack(
    leftHip: Point,
    leftKnee: Point,
    leftAnkle: Point,
    rightHip: Point,
    rightKnee: Point,
    rightAnkle: Point,
  ): AnalysisResponse {
    // 우측 측면 정적 촬영: 양쪽 다리 모두 동일한 cross 부호 규칙(cross>0=과신전) 적용
    const r1 = calculateKneeAngle180Plus(leftHip, leftKnee, leftAnkle, false);
    const r2 = calculateKneeAngle180Plus(rightHip, rightKnee, rightAnkle, false);

    const scoreUsage1 = scoreUsageFromKneeAngle(r1);
    const scoreUsage2 = scoreUsageFromKneeAngle(r2);
    const scoreUsage = Math.min(scoreUsage1, scoreUsage2);

    const getDisease = (angle: number): string => {
      if (angle >= 176.8 && angle < 179.8) return 'NORMAL';
      if (angle < 176.8) return BODY_DISEASES.BENT_KNEES;
      return BODY_DISEASES.BACK_KNEES;
    };

    const disease1 = getDisease(r1);
    const disease2 = getDisease(r2);

    const scoreMapping: ScoreMap[] = [
      { max: 179.8, score: 5, scoreUsage: 100, disease: 'NORMAL' },
      { max: 176.8, score: 15, scoreUsage: 80, disease: '' },
      { max: 174.6, score: 25, scoreUsage: 70, disease: '' },
      { max: 171.3, score: 40, scoreUsage: 60, disease: '' },
      { max: 168.0, score: 55, scoreUsage: 50, disease: '' },
      { max: 0, score: 62, scoreUsage: 30, disease: '' },
    ];

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

    const { response, disease } = getResponseForTwoResult(r1, result1, r2, result2, scoreMapping);
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
}
