import { BODY_DISEASES } from '../../../../common/enums/body-diseases.enum';
import { getLevel } from '../../helpers/body-response.helper';
import { resolveHipFootRotation } from '../../helpers/hip-rotation.helper';
import { PartAnalysis } from './part.analysis';
import { AnalysisResponse, DiseaseResult, Landmarks, Point, ScoreDetail, ScoreMap } from '../../analysis.types';

export class HipJointAnalysis implements PartAnalysis {
  score = 0;
  disease: DiseaseResult[] = [];
  scoreDetail: ScoreDetail = {};

  execute(landmarks: Landmarks, scoreDetail: ScoreDetail): any {
    this.disease = [];
    this.scoreDetail = scoreDetail;

    const { front } = landmarks;
    const leftToe = front?.LeftFootIndex || front?.LeftToe;
    const rightToe = front?.RightFootIndex || front?.RightToe;
    if (!front?.LeftAnkle || !leftToe || !front?.RightAnkle || !rightToe) {
      return { legsTurnedOutwardOrInward: {} };
    }

    const legsTurnedOutwardOrInward = this.checkLegsTurnedInwardOrOutward(
      front.LeftAnkle,
      leftToe,
      front.RightAnkle,
      rightToe,
    );
    this.score = legsTurnedOutwardOrInward.scoreUsage;
    return {
      legsTurnedOutwardOrInward: legsTurnedOutwardOrInward,
    };
  }

  private checkLegsTurnedInwardOrOutward(
    leftAnkle: Point,
    leftToe: Point,
    rightAnkle: Point,
    rightToe: Point,
  ): AnalysisResponse {
    const { leftDir: leftDirection, rightDir: rightDirection } = resolveHipFootRotation(
      leftAnkle,
      leftToe,
      rightAnkle,
      rightToe,
    );

    // 점수 계산
    const isLeftAbnormal  = leftDirection  !== '중앙';
    const isRightAbnormal = rightDirection !== '중앙';

    let score = 5;
    let scoreUsage = 100;
    let diseaseKey: string = 'NORMAL';

    if (isLeftAbnormal || isRightAbnormal) {
      score = 15;
      scoreUsage = 80;

      // 좌우 방향을 종합해 대표 disease 결정
      const inwardCount  = (leftDirection === '안쪽'  ? 1 : 0) + (rightDirection === '안쪽'  ? 1 : 0);
      const outwardCount = (leftDirection === '바깥' ? 1 : 0) + (rightDirection === '바깥' ? 1 : 0);

      if (inwardCount >= outwardCount) {
        diseaseKey = BODY_DISEASES.LEGS_TURNED_INWARD;
      } else {
        diseaseKey = BODY_DISEASES.LEGS_TURNED_OUTWARD;
      }
    }

    if (diseaseKey !== 'NORMAL') {
      this.disease.push({
        key: diseaseKey,
        level: getLevel(score),
        score: score,
      });
    }

    return {
      max: '',
      disease: diseaseKey,
      score: score,
      scoreUsage: scoreUsage,
      result: `${leftDirection}:${rightDirection}`,
      scoreMapping: [],
    };
  }
}
