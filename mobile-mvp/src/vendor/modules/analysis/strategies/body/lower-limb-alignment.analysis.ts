import { BODY_DISEASES } from '../../../../common/enums/body-diseases.enum';
import { scoreUsageFromLegInnerAngle } from '../../helpers/body-score-usage.helper';
import { resolveLegSideAlignment } from '../../helpers/leg-alignment.helper';
import { getLevel, getResponseForTwoResult } from '../../helpers/body-response.helper';
import { PartAnalysis } from './part.analysis';
import { AnalysisResponse, DiseaseResult, Landmarks, Point, ScoreDetail, ScoreMap } from '../../analysis.types';

export class LowerLimbAlignmentAnalysis implements PartAnalysis {
  score = 0;
  disease: DiseaseResult[] = [];
  scoreDetail: ScoreDetail = {};

  execute(landmarks: Landmarks, scoreDetail: ScoreDetail): any {
    this.disease = [];
    this.scoreDetail = scoreDetail;

    const { front } = landmarks;
    if (!front?.LeftHip || !front?.LeftKnee || !front?.LeftAnkle ||
        !front?.RightHip || !front?.RightKnee || !front?.RightAnkle) {
      return { legsBowOrKnock: {} };
    }

    const legsBowOrKnock = this.checkLegsBowOrKnock(
      front.LeftHip,
      front.LeftKnee,
      front.LeftAnkle,
      front.RightHip,
      front.RightKnee,
      front.RightAnkle,
    );
    this.score = legsBowOrKnock.scoreUsage;
    return { legsBowOrKnock: legsBowOrKnock };
  }

  private checkLegsBowOrKnock(
    leftHip: Point,
    leftKnee: Point,
    leftAnkle: Point,
    rightHip: Point,
    rightKnee: Point,
    rightAnkle: Point,
  ): AnalysisResponse {
    const leftLeg = resolveLegSideAlignment(leftHip, leftKnee, leftAnkle, true);
    const rightLeg = resolveLegSideAlignment(rightHip, rightKnee, rightAnkle, false);
    const leftAngle = leftLeg.innerAngle;
    const rightAngle = rightLeg.innerAngle;

    const scoreUsage1 = scoreUsageFromLegInnerAngle(leftAngle);
    const scoreUsage2 = scoreUsageFromLegInnerAngle(rightAngle);
    const scoreUsage = Math.min(scoreUsage1, scoreUsage2);

    const toDisease = (status: string): BODY_DISEASES | 'NORMAL' => {
      if (status === '오다리') return BODY_DISEASES.BOW_LEGS;
      if (status === '엑스다리') return BODY_DISEASES.KNOCK_LEGS;
      return 'NORMAL';
    };

    const leftStatus = { status: leftLeg.status, disease: toDisease(leftLeg.status) };
    const rightStatus = { status: rightLeg.status, disease: toDisease(rightLeg.status) };

    const leftDiff = leftLeg.diffFrom180;
    const rightDiff = rightLeg.diffFrom180;

    const result1: ScoreMap = {
      max: leftDiff,
      score: scoreUsage1 <= 30 ? 62 : scoreUsage1 <= 50 ? 55 : scoreUsage1 <= 60 ? 40 : scoreUsage1 <= 70 ? 25 : scoreUsage1 <= 80 ? 15 : 5,
      scoreUsage: scoreUsage1,
      disease: leftStatus.disease,
    };
    const result2: ScoreMap = {
      max: rightDiff,
      score: scoreUsage2 <= 30 ? 62 : scoreUsage2 <= 50 ? 55 : scoreUsage2 <= 60 ? 40 : scoreUsage2 <= 70 ? 25 : scoreUsage2 <= 80 ? 15 : 5,
      scoreUsage: scoreUsage2,
      disease: rightStatus.disease,
    };

    const { response, disease } = getResponseForTwoResult(leftDiff, result1, rightDiff, result2, []);
    response.scoreUsage = scoreUsage;
    response.result = JSON.stringify({
      left: { status: leftStatus.status, diff: leftDiff.toFixed(1), angle: leftAngle.toFixed(1) },
      right: { status: rightStatus.status, diff: rightDiff.toFixed(1), angle: rightAngle.toFixed(1) },
    });

    if (disease.length > 0) {
      this.disease = this.disease.concat(disease);
    } else if (leftStatus.disease !== 'NORMAL' || rightStatus.disease !== 'NORMAL') {
      const worstDisease = scoreUsage1 <= scoreUsage2 ? leftStatus.disease : rightStatus.disease;
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
