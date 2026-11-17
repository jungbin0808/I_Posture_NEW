import { BODY_DISEASES } from '../../../../common/enums/body-diseases.enum';
import {
  getLevel,
  getResponseForOneResult,
} from '../../helpers/body-response.helper';
import { PartAnalysis } from './part.analysis';
import { AnalysisResponse, DiseaseResult, Landmarks, Point, ScoreDetail, ScoreMap } from '../../analysis.types';

export class BackAnalysis implements PartAnalysis {
  score = 0;
  disease: DiseaseResult[] = [];
  scoreDetail: ScoreDetail = {};

  execute(landmarks: Landmarks, scoreDetail: ScoreDetail): any {
    this.disease = [];
    this.scoreDetail = scoreDetail;

    const rightSide = landmarks.right_side;

    if (!rightSide?.RightEar || !rightSide?.RightEye || !rightSide?.RightShoulder || !rightSide?.RightHip) {
      return { backHunchedOrFlat: {} };
    }

    const backHunchedOrFlat = this.checkBackHunchedOrFlat(
      rightSide.RightEar,
      rightSide.RightEye,
      rightSide.RightShoulder,
      rightSide.RightHip,
    );
    this.score = backHunchedOrFlat.scoreUsage;
    return { backHunchedOrFlat: backHunchedOrFlat };
  }

  private checkBackHunchedOrFlat(rightEar: Point, rightEye: Point, rightShoulder: Point, rightHip: Point): AnalysisResponse {
    if (
      this.scoreDetail.neck?.neckTurtleRaised?.disease ==
      BODY_DISEASES.RAISED_NECK
    ) {
      const response = { ...this.scoreDetail.neck.neckTurtleRaised };
      response.disease = BODY_DISEASES.FLAT_BACK;
      this.disease.push({
        key: response.disease,
        level: getLevel(response.score),
        score: response.score,
      });
      response.result += ' (case 2)';
      return response;
    }

    if (
      this.scoreDetail.neck?.neckTurtleRaised?.disease ==
      BODY_DISEASES.TURTLE_NECK
    ) {
      if (rightEar.y == rightEye.y && rightShoulder.x == rightHip.x) {
        const response = { ...this.scoreDetail.neck.neckTurtleRaised };
        response.disease = BODY_DISEASES.HUNCHED_BACK;
        this.disease.push({
          key: response.disease,
          level: getLevel(response.score),
          score: response.score,
        });
        response.result += ' (case 2)';
        return response;
      }

      let result: ScoreMap | undefined;
      let percent: number = 0;
      let caseStr: string = '';
      const scoreMapping: ScoreMap[] = [
        { max: 0.05, score: 5, scoreUsage: 100, disease: 'NORMAL' },
        { max: 0.1, score: 15, scoreUsage: 80, disease: '' },
        { max: 0.15, score: 25, scoreUsage: 70, disease: '' },
        { max: 0.2, score: 40, scoreUsage: 60, disease: '' },
        { max: 0.25, score: 55, scoreUsage: 50, disease: '' },
        { max: Infinity, score: 62, scoreUsage: 30, disease: '' },
      ];

      if (rightEar.y < rightEye.y || rightEar.y > rightEye.y) {
        if (rightEar.y < rightEye.y) {
          caseStr = ' (case 1)';
        } else {
          caseStr = ' (case 4)';
        }

        percent =
          Math.round(
            Math.abs(
              (rightEar.y - rightEye.y) / ((rightEar.y + rightEye.y) / 2),
            ) * 100,
          ) / 100;
        result = scoreMapping.find((item) => percent <= item.max);
        if (result && !result.disease) result.disease = BODY_DISEASES.HUNCHED_BACK;
      } else if (rightEar.y == rightEye.y && rightShoulder.x < rightHip.x) {
        caseStr = ' (case 3)';
        percent =
          Math.round(
            Math.abs(
              (rightShoulder.x - rightHip.x) /
                ((rightShoulder.x + rightHip.x) / 2),
            ) * 100,
          ) / 100;
        result = scoreMapping.find((item) => percent <= item.max);
        if (result && !result.disease) result.disease = BODY_DISEASES.HUNCHED_BACK;
      } else if (rightEar.y == rightEye.y && rightShoulder.x > rightHip.x) {
        caseStr = ' (case 1)';
        percent =
          Math.round(
            Math.abs(
              (rightShoulder.x - rightHip.x) /
                ((rightShoulder.x + rightHip.x) / 2),
            ) * 100,
          ) / 100;
        result = scoreMapping.find((item) => percent <= item.max);
        if (result && !result.disease) result.disease = BODY_DISEASES.FLAT_BACK;
      } else {
        return {
          max: '',
          disease: 'NORMAL',
          score: 5,
          scoreUsage: 100,
          scoreMapping: [],
          result: '',
        };
      }

      if (!result) {
         return {
          max: '',
          disease: 'NORMAL',
          score: 5,
          scoreUsage: 100,
          scoreMapping: [],
          result: '',
        };
      }

      const { response, disease } = getResponseForOneResult(
        percent,
        result,
        scoreMapping,
      );
      if (disease.length > 0) {
        this.disease = this.disease.concat(disease);
      }
      response.result += caseStr;
      return response;
    }
    return {
        max: '',
        disease: 'NORMAL',
        score: 5,
        scoreUsage: 100,
        scoreMapping: [],
        result: '',
    };
  }
}
