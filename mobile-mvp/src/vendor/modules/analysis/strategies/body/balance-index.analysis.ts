import { calculateDistance } from '../../helpers/distance.helper';
import { getIntersectionPoint } from '../../helpers/intersection.helper';
import { Point } from '../../helpers/point.helper';
import { PartAnalysis } from './part.analysis';
import { AnalysisResponse, DiseaseResult, Landmarks, ScoreDetail, ScoreMap } from '../../analysis.types';

export class BalanceIndexAnalysis implements PartAnalysis {
  score = 0;
  disease: DiseaseResult[] = [];
  scoreDetail: ScoreDetail = {};

  execute(landmarks: Landmarks, scoreDetail: ScoreDetail): any {
    this.disease = [];
    this.scoreDetail = scoreDetail;
    const leftRightBalanceIndex = this.checkLeftRightBalanceIndex(landmarks);
    const frontBackBalanceIndex = this.checkFrontBackBalanceIndex(landmarks);
    this.score =
      (leftRightBalanceIndex.scoreUsage + frontBackBalanceIndex.scoreUsage) / 2;
    return {
      leftRightBalanceIndex: leftRightBalanceIndex,
      frontBackBalanceIndex: frontBackBalanceIndex,
    };
  }

  private checkLeftRightBalanceIndex(landmarks: Landmarks): AnalysisResponse {
    const back = landmarks.back;
    if (!back?.LeftEar || !back?.RightEar || !back?.LeftAnkle || !back?.RightAnkle ||
        !back?.LeftShoulder || !back?.RightShoulder || !back?.LeftHip || !back?.RightHip) {
        return { max: '', score: 0, scoreUsage: 0, disease: '', result: '', scoreMapping: [] };
    }

    const head = this.checkHeadBalance(
      back.LeftEar,
      back.RightEar,
      back.LeftAnkle,
      back.RightAnkle,
    );
    const torso = this.checkTorsoBalance(
      back.LeftShoulder,
      back.RightShoulder,
      back.LeftAnkle,
      back.RightAnkle,
    );
    const pelvis = this.checkPelvisBalance(
      back.LeftHip,
      back.RightHip,
      back.LeftAnkle,
      back.RightAnkle,
    );
    const result = head + torso + pelvis * 2;
    const scoreMapping: ScoreMap[] = [
      { max: 10, score: 5, scoreUsage: 100, disease: '' },
      { max: 20, score: 15, scoreUsage: 80, disease: '' },
      { max: 30, score: 25, scoreUsage: 70, disease: '' },
      { max: 50, score: 40, scoreUsage: 60, disease: '' },
      { max: 60, score: 55, scoreUsage: 50, disease: '' },
      { max: Infinity, score: 62, scoreUsage: 30, disease: '' },
    ];
    const response = scoreMapping.find((item) => Math.abs(result) <= item.max);

    if (!response) {
        return {
            max: '',
            score: 0,
            scoreUsage: 0,
            disease: '',
            result: '',
            scoreMapping: []
        }
    }

    return {
      max: response.max + '',
      score: response.score,
      scoreUsage: response.scoreUsage,
      disease: response.disease,
      result:
        'head:' +
        head +
        ',torso:' +
        torso +
        ',pelvis:' +
        pelvis +
        ',result:' +
        result,
      balance: result == 0 ? 'normal' : result > 0 ? 'right' : 'left',
      scoreMapping: scoreMapping,
    } as AnalysisResponse & { balance: string };
  }
  private checkFrontBackBalanceIndex(landmarks: Landmarks): AnalysisResponse {
    const rightSide = landmarks.right_side;
    if (!rightSide?.RightEar || !rightSide?.LeftAnkle || !rightSide?.RightAnkle ||
        !rightSide?.RightShoulder || !rightSide?.RightHip || !rightSide?.RightKnee) {
        return { max: '', score: 0, scoreUsage: 0, disease: '', result: '', scoreMapping: [] };
    }

    const head = this.checkHeadBalanceSide(
      rightSide.RightEar,
      rightSide.LeftAnkle,
      rightSide.RightAnkle,
    );
    const torso = this.checkTorsoBalanceSide(
      rightSide.RightShoulder,
      rightSide.LeftAnkle,
      rightSide.RightAnkle,
    );
    const pelvis = this.checkPelvisBalanceSide(
      rightSide.RightHip,
      rightSide.LeftAnkle,
      rightSide.RightAnkle,
    );
    const knees = this.checkKneesBalanceSide(
      rightSide.RightKnee,
      rightSide.LeftAnkle,
      rightSide.RightAnkle,
    );
    const result = head + torso + pelvis * 2 + knees;
    const scoreMapping: ScoreMap[] = [
      { max: 10, score: 5, scoreUsage: 100, disease: '' },
      { max: 20, score: 15, scoreUsage: 80, disease: '' },
      { max: 30, score: 25, scoreUsage: 70, disease: '' },
      { max: 50, score: 40, scoreUsage: 60, disease: '' },
      { max: 60, score: 55, scoreUsage: 50, disease: '' },
      { max: Infinity, score: 62, scoreUsage: 30, disease: '' },
    ];
    const response = scoreMapping.find((item) => Math.abs(result) <= item.max);

    if (!response) {
        return {
            max: '',
            score: 0,
            scoreUsage: 0,
            disease: '',
            result: '',
            scoreMapping: []
        }
    }

    return {
      max: response.max + '',
      score: response.score,
      scoreUsage: response.scoreUsage,
      disease: response.disease,
      result:
        'head:' +
        head +
        ',torso:' +
        torso +
        ',pelvis:' +
        pelvis +
        ',knees:' +
        knees +
        ',result:' +
        result,
      balance: result == 0 ? 'normal' : result > 0 ? 'front' : 'back',
      scoreMapping: scoreMapping,
    } as AnalysisResponse & { balance: string };
  }

  private checkHeadBalance(leftEar: Point, rightEar: Point, leftAnkle: Point, rightAnkle: Point): number {
    const leftIntersection = getIntersectionPoint(
      leftEar,
      new Point(0, leftEar.y),
      new Point(
        (leftAnkle.x + rightAnkle.x) / 2,
        (leftAnkle.y + rightAnkle.y) / 2,
      ),
      new Point((leftAnkle.x + rightAnkle.x) / 2, 0),
    );
    const rightIntersection = getIntersectionPoint(
      rightEar,
      new Point(0, rightEar.y),
      new Point(
        (leftAnkle.x + rightAnkle.x) / 2,
        (leftAnkle.y + rightAnkle.y) / 2,
      ),
      new Point((leftAnkle.x + rightAnkle.x) / 2, 0),
    );

    if (!leftIntersection || !rightIntersection) return 0;

    return (
      calculateDistance(rightEar, rightIntersection) -
      calculateDistance(leftEar, leftIntersection)
    );
  }
  private checkTorsoBalance(
    leftShoulder: Point,
    rightShoulder: Point,
    leftAnkle: Point,
    rightAnkle: Point,
  ): number {
    const leftIntersection = getIntersectionPoint(
      leftShoulder,
      new Point(0, leftShoulder.y),
      new Point(
        (leftAnkle.x + rightAnkle.x) / 2,
        (leftAnkle.y + rightAnkle.y) / 2,
      ),
      new Point((leftAnkle.x + rightAnkle.x) / 2, 0),
    );
    const rightIntersection = getIntersectionPoint(
      rightShoulder,
      new Point(0, rightShoulder.y),
      new Point(
        (leftAnkle.x + rightAnkle.x) / 2,
        (leftAnkle.y + rightAnkle.y) / 2,
      ),
      new Point((leftAnkle.x + rightAnkle.x) / 2, 0),
    );

    if (!leftIntersection || !rightIntersection) return 0;

    return (
      calculateDistance(rightShoulder, rightIntersection) -
      calculateDistance(leftShoulder, leftIntersection)
    );
  }
  private checkPelvisBalance(leftHip: Point, rightHip: Point, leftAnkle: Point, rightAnkle: Point): number {
    const leftIntersection = getIntersectionPoint(
      leftHip,
      new Point(0, leftHip.y),
      new Point(
        (leftAnkle.x + rightAnkle.x) / 2,
        (leftAnkle.y + rightAnkle.y) / 2,
      ),
      new Point((leftAnkle.x + rightAnkle.x) / 2, 0),
    );
    const rightIntersection = getIntersectionPoint(
      rightHip,
      new Point(0, rightHip.y),
      new Point(
        (leftAnkle.x + rightAnkle.x) / 2,
        (leftAnkle.y + rightAnkle.y) / 2,
      ),
      new Point((leftAnkle.x + rightAnkle.x) / 2, 0),
    );

    if (!leftIntersection || !rightIntersection) return 0;

    return (
      calculateDistance(rightHip, rightIntersection) -
      calculateDistance(leftHip, leftIntersection)
    );
  }
  private checkHeadBalanceSide(rightEar: Point, leftAnkle: Point, rightAnkle: Point): number {
    const rightIntersection = getIntersectionPoint(
      rightEar,
      new Point(0, rightEar.y),
      new Point(
        (leftAnkle.x + rightAnkle.x) / 2,
        (leftAnkle.y + rightAnkle.y) / 2,
      ),
      new Point((leftAnkle.x + rightAnkle.x) / 2, 0),
    );

    if (!rightIntersection) return 0;

    const isBack = rightEar.x < rightIntersection.x ? -1 : 1;
    return calculateDistance(rightEar, rightIntersection) * isBack;
  }
  private checkTorsoBalanceSide(rightShoulder: Point, leftAnkle: Point, rightAnkle: Point): number {
    const rightIntersection = getIntersectionPoint(
      rightShoulder,
      new Point(0, rightShoulder.y),
      new Point(
        (leftAnkle.x + rightAnkle.x) / 2,
        (leftAnkle.y + rightAnkle.y) / 2,
      ),
      new Point((leftAnkle.x + rightAnkle.x) / 2, 0),
    );

    if (!rightIntersection) return 0;

    const isBack = rightShoulder.x < rightIntersection.x ? -1 : 1;
    return calculateDistance(rightShoulder, rightIntersection) * isBack;
  }
  private checkPelvisBalanceSide(rightHip: Point, leftAnkle: Point, rightAnkle: Point): number {
    const rightIntersection = getIntersectionPoint(
      rightHip,
      new Point(0, rightHip.y),
      new Point(
        (leftAnkle.x + rightAnkle.x) / 2,
        (leftAnkle.y + rightAnkle.y) / 2,
      ),
      new Point((leftAnkle.x + rightAnkle.x) / 2, 0),
    );

    if (!rightIntersection) return 0;

    const isBack = rightHip.x < rightIntersection.x ? -1 : 1;
    return calculateDistance(rightHip, rightIntersection) * isBack;
  }
  private checkKneesBalanceSide(rightKnee: Point, leftAnkle: Point, rightAnkle: Point): number {
    const rightIntersection = getIntersectionPoint(
      rightKnee,
      new Point(0, rightKnee.y),
      new Point(
        (leftAnkle.x + rightAnkle.x) / 2,
        (leftAnkle.y + rightAnkle.y) / 2,
      ),
      new Point((leftAnkle.x + rightAnkle.x) / 2, 0),
    );

    if (!rightIntersection) return 0;

    const isBack = rightKnee.x < rightIntersection.x ? -1 : 1;
    return calculateDistance(rightKnee, rightIntersection) * isBack;
  }
}
