import { BODY_DISEASES } from '../../../../common/enums/body-diseases.enum';
import { getResponseForOneResult } from '../../helpers/body-response.helper';
import { calculateDistance } from '../../helpers/distance.helper';
import { PartAnalysis } from './part.analysis';
import { AnalysisResponse, DiseaseResult, Landmarks, Point, ScoreDetail, ScoreMap } from '../../analysis.types';

export class TorsoAnalysis implements PartAnalysis {
  score = 0;
  disease: DiseaseResult[] = [];
  scoreDetail: ScoreDetail = {};

  execute(landmarks: Landmarks, scoreDetail: ScoreDetail): any {
    this.disease = [];
    this.scoreDetail = scoreDetail;

    const { front, right_side } = landmarks;
    if (!front?.LeftShoulder || !front?.LeftHip || !front?.RightShoulder || !front?.RightHip ||
        !right_side?.LeftShoulder || !right_side?.RightShoulder || !right_side?.LeftHip || !right_side?.RightHip) {
      return { torsoTiltedRightOrLeft: {}, torsoRotation: {} };
    }

    const torsoTiltedRightOrLeft = this.checkTorsoTiltedRightOrLeft(
      front.LeftShoulder,
      front.LeftHip,
      front.RightShoulder,
      front.RightHip,
    );
    const torsoRotation = this.checkTorsoRotation(
      right_side.LeftShoulder,
      right_side.RightShoulder,
      right_side.LeftHip,
      right_side.RightHip,
    );
    this.score =
      (torsoTiltedRightOrLeft.scoreUsage + torsoRotation.scoreUsage) / 2;
    return {
      torsoTiltedRightOrLeft: torsoTiltedRightOrLeft,
      torsoRotation: torsoRotation,
    };
  }

  private checkTorsoRotation(leftShoulder: Point, rightShoulder: Point, leftHip: Point, rightHip: Point): AnalysisResponse {
    const { x: x1 } = leftShoulder;
    const { x: x2 } = rightShoulder;
    const { x: x3 } = leftHip;
    const { x: x4 } = rightHip;
    const AB = calculateDistance(leftShoulder, rightShoulder);
    const CD = calculateDistance(leftHip, rightHip);

    const scoreMapping: ScoreMap[] = [
      { max: 0, score: 5, scoreUsage: 100, disease: 'NORMAL' },
      { max: 5, score: 15, scoreUsage: 80, disease: '' },
      { max: 10, score: 25, scoreUsage: 70, disease: '' },
      { max: 15, score: 40, scoreUsage: 60, disease: '' },
      { max: 20, score: 55, scoreUsage: 50, disease: '' },
      { max: Infinity, score: 62, scoreUsage: 30, disease: '' },
    ];

    let distance = 0;
    let diseaseCheck = 'NORMAL';
    if (AB == CD && x1 < x2 && x3 > x4) {
      distance = AB + CD;
      diseaseCheck = BODY_DISEASES.TORSO_ROTATION_LEFT;
    } else if (AB == CD && x1 > x2 && x3 < x4) {
      distance = AB + CD;
      diseaseCheck = BODY_DISEASES.TORSO_ROTATION_RIGHT;
    } else if (AB != CD && x1 < x2 && x3 > x4) {
      distance = AB + CD;
      diseaseCheck = BODY_DISEASES.TORSO_ROTATION_LEFT;
    } else if (AB != CD && x1 > x2 && x3 < x4) {
      distance = AB + CD;
      diseaseCheck = BODY_DISEASES.TORSO_ROTATION_RIGHT;
    } else if (AB != CD && x1 < x2 && x3 < x4) {
      distance = Math.abs(AB - CD);
      diseaseCheck = BODY_DISEASES.TORSO_ROTATION_LEFT;
    } else if (AB != CD && x1 > x2 && x3 > x4) {
      distance = Math.abs(AB - CD);
      diseaseCheck = BODY_DISEASES.TORSO_ROTATION_RIGHT;
    }

    const defaultResult: ScoreMap = { max: Infinity, score: 5, scoreUsage: 100, disease: 'NORMAL' };
    const result = scoreMapping.find((item) => distance <= item.max) || defaultResult;
    result.disease = diseaseCheck;

    const { response, disease } = getResponseForOneResult(
      distance,
      result,
      scoreMapping,
    );
    if (disease.length > 0) {
      this.disease = this.disease.concat(disease);
    }
    return response;
  }

  private checkTorsoTiltedRightOrLeft(
    leftShoulder: Point,
    leftHip: Point,
    rightShoulder: Point,
    rightHip: Point,
  ): AnalysisResponse {
    const { x: x1 } = leftShoulder;
    const { x: x2 } = rightShoulder;
    const { x: x3 } = leftHip;
    const { x: x4 } = rightHip;
    //Find X(x5,y5)
    const x5 = (x1 + x2) / 2;
    //find Y(x6,y6)
    const x6 = (x3 + x4) / 2;
    const percent =
      Math.round(Math.abs((x5 - x6) / ((x5 + x6) / 2)) * 100) / 100;
    const scoreMapping: ScoreMap[] = [
      { max: 0.05, score: 5, scoreUsage: 100, disease: 'NORMAL' },
      { max: 0.1, score: 15, scoreUsage: 80, disease: '' },
      { max: 0.15, score: 25, scoreUsage: 70, disease: '' },
      { max: 0.2, score: 40, scoreUsage: 60, disease: '' },
      { max: 0.25, score: 55, scoreUsage: 50, disease: '' },
      { max: Infinity, score: 62, scoreUsage: 30, disease: '' },
    ];

    const defaultResult: ScoreMap = { max: Infinity, score: 5, scoreUsage: 100, disease: 'NORMAL' };
    const result = scoreMapping.find((item) => percent <= item.max) || defaultResult;

    if (!result.disease) {
      result.disease = 'NORMAL';
      if (x5 < x6) {
        result.disease = BODY_DISEASES.TORSO_TILTED_RIGHT;
      } else if (x5 > x6) {
        result.disease = BODY_DISEASES.TORSO_TILTED_LEFT;
      }
    }
    const { response, disease } = getResponseForOneResult(
      percent,
      result,
      scoreMapping,
    );
    if (disease.length > 0) {
      this.disease = this.disease.concat(disease);
    }
    return response;
  }
}
