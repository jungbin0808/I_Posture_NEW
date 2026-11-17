import { BODY_DISEASES } from '../../../../common/enums/body-diseases.enum';
import { calculateAngle } from '../../helpers/angle.helper';
import {
  getLevel,
  getResponseForOneResult,
} from '../../helpers/body-response.helper';
import {
  minScoreUsage,
  scoreUsageFromPelvisLateralShiftDiff,
  scoreUsageFromSwaybackDeviation,
} from '../../helpers/body-score-usage.helper';
import { calculateKneeAngle180Plus } from '../../helpers/angle.helper';
import { resolvePelvisTilt7Case } from '../../helpers/pelvis-tilt.helper';
import { calculateDistance } from '../../helpers/distance.helper';
import { PartAnalysis } from './part.analysis';
import { AnalysisResponse, DiseaseResult, Landmarks, Point, ScoreDetail, ScoreMap } from '../../analysis.types';

export class PelvisAnalysis implements PartAnalysis {
  score = 0;
  disease: DiseaseResult[] = [];
  scoreDetail: ScoreDetail = {};

  execute(landmarks: Landmarks, scoreDetail: ScoreDetail): any {
    this.disease = [];
    this.scoreDetail = scoreDetail;

    const { front, back, right_side } = landmarks;
    if (!front?.LeftHip || !front?.RightHip || !front?.LeftAnkle || !front?.RightAnkle ||
        !back?.LeftHip || !back?.RightHip ||
        !right_side?.LeftHip || !right_side?.RightHip || !right_side?.LeftAnkle || !right_side?.RightAnkle ||
        !right_side?.RightShoulder || !right_side?.RightKnee) {
      return { pelvisAsymmetry: {}, pelvisRotation: {}, pelvisMove: {}, pelvisTilt: {}, isSwayBack: {} };
    }

    const pelvisAsymmetry = this.checkPelvisAsymmetry(
      front.LeftHip,
      front.RightHip,
    );
    const pelvisRotation = this.checkPelvisRotation(
      front.LeftHip, front.RightHip, // F
      back.LeftHip, back.RightHip,   // B
      right_side.LeftHip, right_side.RightHip, // S
    );
    const pelvisMove = this.checkPelvisMoveLeftOrRight(
      front.LeftHip,
      front.RightHip,
      front.LeftAnkle,
      front.RightAnkle,
    );
    const pelvisTilt = this.checkPelvisTilt(
      right_side.RightAnkle,
      right_side.RightKnee,
      right_side.RightHip,
      right_side.RightShoulder,
    );
    const isSwayBack = this.checkSwayBack(
      right_side.RightHip,
      right_side.RightAnkle,
    );
    this.score = minScoreUsage([
      pelvisAsymmetry.scoreUsage,
      pelvisMove.scoreUsage,
      isSwayBack.scoreUsage,
    ]);
    return {
      pelvisAsymmetry: pelvisAsymmetry,
      pelvisRotation: pelvisRotation,
      pelvisMove: pelvisMove,
      pelvisTilt: pelvisTilt,
      isSwayBack: isSwayBack,
    };
  }

  private checkPelvisRotation(
    frontLeftHip: Point, frontRightHip: Point,
    backLeftHip: Point, backRightHip: Point,
    sideLeftHip: Point, sideRightHip: Point,
  ): AnalysisResponse {
    const F = calculateDistance(frontLeftHip, frontRightHip);
    const B = calculateDistance(backLeftHip, backRightHip);
    const S = calculateDistance(sideLeftHip, sideRightHip);

    const W = Math.max(F, B);
    const r = Math.min(1, S / W);
    const rotationAngle = Math.asin(r) * (180 / Math.PI);

    // 사이드뷰(우측 카메라): 왼쪽 hip이 앞으로 나오면(x가 작으면) 골반이 오른쪽으로 회전된 것
    // sideLeftHip.x < sideRightHip.x → 왼쪽 hip이 앞 → 오른쪽 회전
    // sideLeftHip.x > sideRightHip.x → 왼쪽 hip이 뒤 → 왼쪽 회전
    let direction = '중앙';
    if (sideLeftHip.x < sideRightHip.x) {
      direction = '오른쪽';
    } else if (sideLeftHip.x > sideRightHip.x) {
      direction = '왼쪽';
    }

    const scoreMapping: ScoreMap[] = [
      { max: 5, score: 5, scoreUsage: 100, disease: 'NORMAL' },
      { max: 10, score: 15, scoreUsage: 80, disease: BODY_DISEASES.PELVIS_ROTATION_LEFT },
      { max: 15, score: 25, scoreUsage: 70, disease: BODY_DISEASES.PELVIS_ROTATION_LEFT },
      { max: 20, score: 40, scoreUsage: 60, disease: BODY_DISEASES.PELVIS_ROTATION_LEFT },
      { max: 25, score: 55, scoreUsage: 50, disease: BODY_DISEASES.PELVIS_ROTATION_LEFT },
      { max: Infinity, score: 62, scoreUsage: 30, disease: BODY_DISEASES.PELVIS_ROTATION_LEFT },
    ];

    const defaultResult: ScoreMap = { max: Infinity, score: 5, scoreUsage: 100, disease: 'NORMAL' };
    const result = scoreMapping.find((item) => rotationAngle <= item.max) || defaultResult;

    if (result.disease !== 'NORMAL') {
      result.disease = direction === '왼쪽' ? BODY_DISEASES.PELVIS_ROTATION_LEFT : BODY_DISEASES.PELVIS_ROTATION_RIGHT;
    }

    const { response, disease } = getResponseForOneResult(
      rotationAngle,
      result,
      scoreMapping,
    );

    response.result = `${direction}:${rotationAngle.toFixed(1)}`;

    response.scoreUsage = 100;
    if (disease.length > 0) {
      this.disease = this.disease.concat(disease);
    }
    return response;
  }

  private checkPelvisTilt(
    rightAnkle: Point,
    rightKnee: Point,
    rightHip: Point,
    rightShoulder: Point,
  ): AnalysisResponse {
    const rightKneeAngle = calculateKneeAngle180Plus(rightHip, rightKnee, rightAnkle);
    const { status, tiltCase, angle } = resolvePelvisTilt7Case(
      rightAnkle,
      rightKnee,
      rightHip,
      rightShoulder,
      rightKneeAngle,
    );

    const kneeAbnormal = tiltCase === '1-A' || tiltCase === '1-B';
    let score = 5;
    let diseaseKey = 'NORMAL';

    if (status !== '중립') {
      if (kneeAbnormal) {
        score = this.scoreDetail.knee?.kneesBentOrBack?.score || 25;
      } else {
        score = 25;
      }
      diseaseKey = status === '앞기울임'
        ? BODY_DISEASES.PELVIS_TILTS_FORWARD
        : BODY_DISEASES.PELVIS_TILTS_BACKWARD;

      this.disease.push({
        key: diseaseKey,
        level: getLevel(score),
        score,
      });
    }

    return {
      max: '',
      score,
      scoreUsage: 100,
      disease: diseaseKey,
      scoreMapping: [],
      result: JSON.stringify({ status, angle: angle.toFixed(1), case: tiltCase }),
    };
  }

  private checkSwayBack(rightHip: Point, rightAnkle: Point): AnalysisResponse {
    const deviationMm = rightHip.x - rightAnkle.x;
    const scoreUsage = scoreUsageFromSwaybackDeviation(deviationMm);

    let position = '같은 수직선상';
    let diseaseKey = 'NORMAL';
    let score = 5;

    if (deviationMm > 5) {
      position = '앞쪽';
      diseaseKey = BODY_DISEASES.SWAY_BACK;
    } else if (deviationMm < -5) {
      position = '뒤쪽';
    }

    if (diseaseKey !== 'NORMAL') {
      score = scoreUsage <= 30 ? 62 : scoreUsage <= 50 ? 55 : scoreUsage <= 60 ? 40 : scoreUsage <= 70 ? 25 : 15;
      this.disease.push({
        key: diseaseKey,
        level: getLevel(score),
        score: score,
      });
    }

    return {
      max: '',
      result: JSON.stringify({ position, deviation: deviationMm.toFixed(1) }),
      score: score,
      scoreUsage: scoreUsage,
      disease: diseaseKey,
      scoreMapping: [],
    };
  }

  private checkPelvisMoveLeftOrRight(leftHip: Point, rightHip: Point, leftAnkle: Point, rightAnkle: Point): AnalysisResponse {
    const centerX = (leftAnkle.x + rightAnkle.x) / 2;
    const leftDist = Math.abs(leftHip.x - centerX);
    const rightDist = Math.abs(rightHip.x - centerX);
    const diff = Math.abs(leftDist - rightDist);
    const scoreUsage = scoreUsageFromPelvisLateralShiftDiff(diff);

    let diseaseKey: string = 'NORMAL';
    if (diff > 0.3) {
      diseaseKey = leftDist > rightDist
        ? BODY_DISEASES.PELVIS_MOVE_LEFT
        : BODY_DISEASES.PELVIS_MOVE_RIGHT;
    }

    const score = scoreUsage <= 30 ? 62
      : scoreUsage <= 50 ? 55
      : scoreUsage <= 60 ? 40
      : scoreUsage <= 70 ? 25
      : scoreUsage <= 80 ? 15
      : 5;

    const scoreMapping: ScoreMap[] = [
      { max: 0.3, score: 5, scoreUsage: 100, disease: 'NORMAL' },
      { max: Infinity, score, scoreUsage, disease: diseaseKey },
    ];
    const result = scoreMapping.find((item) => diff <= item.max) || scoreMapping[1];

    const { response, disease } = getResponseForOneResult(diff, result, scoreMapping);
    response.result = JSON.stringify({ leftDist: leftDist.toFixed(1), rightDist: rightDist.toFixed(1), diff: diff.toFixed(1) });

    if (disease.length > 0) {
      this.disease = this.disease.concat(disease);
    }
    return response;
  }

  private checkPelvisAsymmetry(leftHip: Point, rightHip: Point): AnalysisResponse {
    const dy = rightHip.y - leftHip.y;
    const dx = rightHip.x - leftHip.x;
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = angleRad * (180 / Math.PI);

    let status = '동일한';
    const tiltAngle = Math.abs(angleDeg);

    if (angleDeg > 1) {
      status = '내려간';
    } else if (angleDeg < -1) {
      status = '올라간';
    }

    const scoreMapping: ScoreMap[] = [
      { max: 1, score: 5, scoreUsage: 100, disease: 'NORMAL' },
      { max: 2, score: 15, scoreUsage: 80, disease: BODY_DISEASES.PELVIS_ASYMMETRY },
      { max: 4, score: 25, scoreUsage: 70, disease: BODY_DISEASES.PELVIS_ASYMMETRY },
      { max: 5, score: 40, scoreUsage: 60, disease: BODY_DISEASES.PELVIS_ASYMMETRY },
      { max: 7, score: 55, scoreUsage: 50, disease: BODY_DISEASES.PELVIS_ASYMMETRY },
      { max: Infinity, score: 62, scoreUsage: 30, disease: BODY_DISEASES.PELVIS_ASYMMETRY },
    ];
    const defaultResult: ScoreMap = { max: Infinity, score: 5, scoreUsage: 100, disease: 'NORMAL' };
    // 점수 매핑은 보정 각도 기준 (표시 시 service에서 보정)
    const fixedTiltAngle = tiltAngle > 90 ? 180 - tiltAngle : tiltAngle;
    const result = scoreMapping.find((item) => fixedTiltAngle <= item.max) || defaultResult;
    const { response, disease } = getResponseForOneResult(
      tiltAngle,
      result,
      scoreMapping,
    );

    response.result = `${status}:${tiltAngle.toFixed(1)}`; // raw 각도 저장 (service에서 보정)

    if (disease.length > 0) {
      this.disease = this.disease.concat(disease);
    }
    return response;
  }
}
