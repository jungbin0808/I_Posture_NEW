import { BODY_DISEASES } from '../../../../common/enums/body-diseases.enum';
import { calculateAngle } from '../../helpers/angle.helper';
import { getResponseForTwoResult } from '../../helpers/body-response.helper';
import { PartAnalysis } from './part.analysis';
import { AnalysisResponse, DiseaseResult, Landmarks, Point, ScoreDetail, ScoreMap } from '../../analysis.types';

export class UpperArmAnalysis implements PartAnalysis {
  score = 0;
  disease: DiseaseResult[] = [];
  scoreDetail: ScoreDetail = {};

  execute(landmarks: Landmarks, scoreDetail: ScoreDetail): any {
    this.disease = [];
    this.scoreDetail = scoreDetail;

    const { front, left_side, right_side } = landmarks;
    if (!front?.LeftWrist || !front?.LeftPinkyFinger || !front?.LeftThumb || !front?.RightWrist || !front?.RightPinkyFinger || !front?.RightThumb ||
        !left_side?.LeftShoulder || !left_side?.LeftElbow || !left_side?.LeftWrist ||
        !right_side?.RightShoulder || !right_side?.RightElbow || !right_side?.RightWrist) {
      return { armsTurnedInOrOut: {}, elbowBentOrExtended: {} };
    }

    const armsTurnedInOrOut = this.checkArmsTurnedInOrOut(
      front.LeftWrist,
      front.LeftPinkyFinger,
      front.LeftThumb,
      front.RightWrist,
      front.RightPinkyFinger,
      front.RightThumb,
    );

    const elbowBentOrExtended = this.checkElbowBentOrExtended(
      left_side.LeftShoulder,
      left_side.LeftElbow,
      left_side.LeftWrist,
      right_side.RightShoulder,
      right_side.RightElbow,
      right_side.RightWrist,
    );
    this.score =
      (armsTurnedInOrOut.scoreUsage + elbowBentOrExtended.scoreUsage) / 2;
    return {
      armsTurnedInOrOut: armsTurnedInOrOut,
      elbowBentOrExtended: elbowBentOrExtended,
    };
  }

  private checkElbowBentOrExtended(
    leftShoulder: Point,
    leftElbow: Point,
    leftWrist: Point,
    rightShoulder: Point,
    rightElbow: Point,
    rightWrist: Point,
  ): AnalysisResponse {
    const { x: x1 } = leftShoulder;
    const { x: x2 } = leftElbow;
    const { x: x3 } = leftWrist;
    const { x: x4 } = rightShoulder;
    const { x: x5 } = rightElbow;
    const { x: x6 } = rightWrist;
    const r1 = calculateAngle(leftElbow, leftShoulder, leftWrist);
    const r2 = calculateAngle(rightElbow, rightShoulder, rightWrist);
    const scoreMapping: ScoreMap[] = [
      { max: 180, score: 5, scoreUsage: 100, disease: 'NORMAL' },
      { max: 175, score: 15, scoreUsage: 80, disease: '' },
      { max: 170, score: 25, scoreUsage: 70, disease: '' },
      { max: 165, score: 40, scoreUsage: 60, disease: '' },
      { max: 160, score: 55, scoreUsage: 50, disease: '' },
      { max: 0, score: 62, scoreUsage: 30, disease: '' },
    ];

    const defaultResult: ScoreMap = { max: Infinity, score: 5, scoreUsage: 100, disease: 'NORMAL' };
    const result1 = scoreMapping.find((item) => r1 >= item.max) || defaultResult;
    const result2 = scoreMapping.find((item) => r2 >= item.max) || defaultResult;

    //check left leg
    if (!result1.disease) {
      result1.disease = 'NORMAL';
      if (x2 > x1 && x2 > x3) {
        result1.disease = BODY_DISEASES.BENT_ELBOW;
      } else if (x2 < x1 && x2 < x3) {
        result1.disease = BODY_DISEASES.EXTENDED_ELBOW;
      }
    }
    //check right leg
    if (!result2.disease) {
      result2.disease = 'NORMAL';
      if (x5 > x4 && x5 > x6) {
        result2.disease = BODY_DISEASES.EXTENDED_ELBOW;
      } else if (x5 < x4 && x5 < x6) {
        result2.disease = BODY_DISEASES.BENT_ELBOW;
      }
    }
    const { response, disease } = getResponseForTwoResult(
      r1,
      result1,
      r2,
      result2,
      scoreMapping,
    );
    if (disease.length > 0) {
      this.disease = this.disease.concat(disease);
    }
    return response;
  }

  private checkArmsTurnedInOrOut(
    leftWrist: Point,
    leftPinky: Point,
    leftThumb: Point,
    rightWrist: Point,
    rightPinky: Point,
    rightThumb: Point,
  ): AnalysisResponse {
    const { x: x2 } = leftPinky;
    const { x: x3 } = leftThumb;
    const { x: x5 } = rightPinky;
    const { x: x6 } = rightThumb;
    const r1 = calculateAngle(leftWrist, leftPinky, leftThumb);
    const r2 = calculateAngle(rightWrist, rightPinky, rightThumb);
    const scoreMapping: ScoreMap[] = [
      { max: 5, score: 5, scoreUsage: 100, disease: 'NORMAL' },
      { max: 10, score: 15, scoreUsage: 80, disease: '' },
      { max: 15, score: 25, scoreUsage: 70, disease: '' },
      { max: 20, score: 40, scoreUsage: 60, disease: '' },
      { max: 25, score: 55, scoreUsage: 50, disease: '' },
      { max: 180, score: 62, scoreUsage: 30, disease: '' },
    ];

    const defaultResult: ScoreMap = { max: Infinity, score: 5, scoreUsage: 100, disease: 'NORMAL' };
    const result1 = scoreMapping.find((item) => r1 <= item.max) || defaultResult;
    const result2 = scoreMapping.find((item) => r2 <= item.max) || defaultResult;

    //check left leg
    if (!result1.disease) {
      result1.disease = 'NORMAL';
      if (x3 < x2) {
        result1.disease = BODY_DISEASES.ARMS_TURNED_IN;
      } else if (x3 > x2) {
        result1.disease = BODY_DISEASES.ARMS_TURNED_OUT;
      }
    }
    //check right leg
    if (!result2.disease) {
      result2.disease = 'NORMAL';
      if (x6 < x5) {
        result2.disease = BODY_DISEASES.ARMS_TURNED_OUT;
      } else if (x6 > x5) {
        result2.disease = BODY_DISEASES.ARMS_TURNED_IN;
      }
    }

    const { response, disease } = getResponseForTwoResult(
      r1,
      result1,
      r2,
      result2,
      scoreMapping,
    );
    if (disease.length > 0) {
      this.disease = this.disease.concat(disease);
    }
    return response;
  }
}
