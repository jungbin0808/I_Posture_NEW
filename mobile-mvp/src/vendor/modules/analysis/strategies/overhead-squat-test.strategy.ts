import { PRECISE_DISEASES } from '../../../common/enums/precise-diseases.enum';
import { calculateAngle } from '../helpers/angle.helper';
import { getIntersectionPoint } from '../helpers/intersection.helper';
import { Point } from '../helpers/point.helper';
import { AnalyticResult } from './analytic.result';
import { AnalyticStrategy } from './analytic.strategy';
import { DiseaseResult, Landmarks, ScoreDetail } from '../analysis.types';
import { OVERHEAD_SQUAT } from '../analysis.constants';

export class OverheadSquatTestStrategy implements AnalyticStrategy {
  async execute(landmarks: Landmarks): Promise<AnalyticResult> {
    const disease: DiseaseResult[] = [];
    const scoreDetail: ScoreDetail = {};

    if (!landmarks.end_front || !landmarks.end_back || !landmarks.end_left || !landmarks.end_right) {
      return new AnalyticResult(0, {}, []);
    }

    scoreDetail.hipCenter = this.checkHipCenter(
      landmarks.end_front.LeftHip,
      landmarks.end_front.RightHip,
      landmarks.end_front.LeftAnkle,
      landmarks.end_front.RightAnkle,
      landmarks.end_front.Nose,
    );
    if (scoreDetail.hipCenter.disease != 'NORMAL') {
      disease.push({
        key: scoreDetail.hipCenter.disease,
        level: 'LEVEL_' + scoreDetail.hipCenter.score,
        score: 0,
      });
    }
    scoreDetail.foot = this.checkFoot(
      landmarks.end_front.LeftKnee,
      landmarks.end_front.LeftAnkle,
      landmarks.end_front.LeftToe,
      landmarks.end_front.RightKnee,
      landmarks.end_front.RightAnkle,
      landmarks.end_front.RightToe,
    );
    if (scoreDetail.foot.disease != 'NORMAL') {
      disease.push({
        key: scoreDetail.foot.disease,
        level: 'LEVEL_' + scoreDetail.foot.score,
        score: 0,
      });
    }
    const kneeLandmarks = [
      landmarks.end_front.LeftHip, landmarks.end_front.LeftKnee, landmarks.end_front.LeftAnkle,
      landmarks.end_front.RightHip, landmarks.end_front.RightKnee, landmarks.end_front.RightAnkle,
    ];
    scoreDetail.knees = kneeLandmarks.every(Boolean)
      ? this.checkKnees(
          landmarks.end_front.LeftHip,
          landmarks.end_front.LeftKnee,
          landmarks.end_front.LeftAnkle,
          landmarks.end_front.RightHip,
          landmarks.end_front.RightKnee,
          landmarks.end_front.RightAnkle,
        )
      : { result: 180, leftInnerAngle: 180, rightInnerAngle: 180, score: 1, disease: 'NORMAL' };
    if (scoreDetail.knees.disease != 'NORMAL') {
      disease.push({
        key: scoreDetail.knees.disease,
        level: 'LEVEL_' + scoreDetail.knees.score,
        score: 0,
      });
    }
    scoreDetail.ankles = this.checkAnkle(
      landmarks.end_back.LeftHeel,
      landmarks.end_back.LeftAnkle,
      landmarks.end_back.RightHeel,
      landmarks.end_back.RightAnkle,
    );
    if (scoreDetail.ankles.disease != 'NORMAL') {
      disease.push({
        key: scoreDetail.ankles.disease,
        level: 'LEVEL_' + scoreDetail.ankles.score,
        score: 0,
      });
    }
    scoreDetail.hipHigher = this.checkHipHigher(
      landmarks.end_back.LeftHip,
      landmarks.end_back.RightHip,
      landmarks.end_back.LeftHeel,
      landmarks.end_back.RightHeel,
    );
    if (scoreDetail.hipHigher.disease != 'NORMAL') {
      disease.push({
        key: scoreDetail.hipHigher.disease,
        level: 'LEVEL_' + scoreDetail.hipHigher.score,
        score: 0,
      });
    }
    scoreDetail.arm = this.checkArm(
      landmarks.end_left.LeftElbow,
      landmarks.end_left.LeftShoulder,
      landmarks.end_left.LeftHip,
      landmarks.end_right.RightElbow,
      landmarks.end_right.RightShoulder,
      landmarks.end_right.RightHip,
    );
    if (scoreDetail.arm.disease != 'NORMAL') {
      disease.push({
        key: scoreDetail.arm.disease,
        level: 'LEVEL_' + scoreDetail.arm.score,
        score: 0,
      });
    }
    scoreDetail.body = this.checkBody(
      landmarks.end_right.RightKnee,
      landmarks.end_right.RightAnkle,
      landmarks.end_right.RightHip,
      landmarks.end_right.RightShoulder,
      landmarks.end_left.LeftKnee,
      landmarks.end_left.LeftAnkle,
      landmarks.end_left.LeftHip,
      landmarks.end_left.LeftShoulder,
    );
    if (scoreDetail.body.disease != 'NORMAL') {
      disease.push({
        key: scoreDetail.body.disease,
        level: 'LEVEL_' + scoreDetail.body.score,
        score: 0,
      });
    }
    scoreDetail.heel = this.checkHeel(
      landmarks.end_left.LeftHeel,
      landmarks.end_left.LeftToe,
      landmarks.end_left.LeftAnkle,
      landmarks.end_right.RightHeel,
      landmarks.end_right.RightToe,
      landmarks.end_right.RightAnkle,
    );
    if (scoreDetail.heel.disease != 'NORMAL') {
      disease.push({
        key: scoreDetail.heel.disease,
        level: 'LEVEL_' + scoreDetail.heel.score,
        score: 0,
      });
    }
    return new AnalyticResult(0, scoreDetail, disease);
  }

  private checkHipCenter(leftHip: Point, rightHip: Point, leftAnkle: Point, rightAnkle: Point, nose?: Point) {
    // ankleMid 기준 좌우 hip 수평 거리 비교
    const ankleMidX = (rightAnkle.x + leftAnkle.x) / 2;
    const ankleMidY = (rightAnkle.y + leftAnkle.y) / 2;
    const ankleMid = { x: ankleMidX, y: ankleMidY };

    const rightHipDistance = Math.abs(rightHip.x - ankleMidX);
    const leftHipDistance = Math.abs(leftHip.x - ankleMidX);
    // 양수 = 우측 hip이 더 멀리 있음(우측 편위), 음수 = 좌측 편위
    const hipDistanceDiff = rightHipDistance - leftHipDistance;
    const diff = Math.abs(hipDistanceDiff);

    // centerLeanAngle: ankleMid → Nose 벡터와 수직선 사이 각도
    let centerLeanAngle = 0;
    if (nose) {
      const dx = nose.x - ankleMidX;
      const dy = nose.y - ankleMidY;
      centerLeanAngle = Math.atan2(dx, -dy) * (180 / Math.PI);
    }

    const levelMapping = [
      { max: 5, score: 1 },
      { max: 10, score: 2 },
      { max: 15, score: 3 },
      { max: 20, score: 4 },
      { max: Infinity, score: 5 },
    ];
    const level = levelMapping.find((item) => diff <= item.max) || { score: 1 };

    return {
      result: hipDistanceDiff,
      rightHipDistance,
      leftHipDistance,
      hipDistanceDiff,
      ankleMid,
      centerLeanAngle,
      score: level.score,
      disease: level.score === 1
        ? 'NORMAL'
        : hipDistanceDiff > 0
        ? PRECISE_DISEASES.HIP_NOT_CENTER_RIGHT
        : PRECISE_DISEASES.HIP_NOT_CENTER_LEFT,
    };
  }

  private checkFoot(
    leftKnee: Point,
    leftAnkle: Point,
    leftFoot: Point,
    rightKnee: Point,
    rightAnkle: Point,
    rightFoot: Point,
  ) {
    const leftFootResult = this.checkLeftFoot(leftKnee, leftAnkle, leftFoot);
    const rightFootResult = this.checkRightFoot(
      rightKnee,
      rightAnkle,
      rightFoot,
    );

    // ankle에 비해 foot index가 몸의 중심 방향으로 가면 마이너스
    // 정면 비미러 기준: 좌발 내측 = 왼쪽(−x), 우발 내측 = 오른쪽(+x)
    const ltAngle = leftFootResult.signedAngle;
    const rtAngle = rightFootResult.signedAngle;
    const representative = Math.max(Math.abs(ltAngle), Math.abs(rtAngle));

    const isNormal =
      representative >= OVERHEAD_SQUAT.FOOT_DIRECTION_NORMAL_MIN_DEG
      && representative <= OVERHEAD_SQUAT.FOOT_DIRECTION_NORMAL_MAX_DEG;

    let disease = 'NORMAL';
    let score = 1;

    if (!isNormal) {
      const outwardMin = OVERHEAD_SQUAT.FOOT_PER_SIDE_OUTWARD_MIN_DEG;
      const ltInward  = ltAngle < 0;
      const ltOutward = ltAngle >= outwardMin;
      const ltNormal  = !ltInward && !ltOutward;
      const rtInward  = rtAngle < 0;
      const rtOutward = rtAngle >= outwardMin;
      const rtNormal  = !rtInward && !rtOutward;

      if (ltOutward && rtInward) {
        disease = PRECISE_DISEASES.FOOT_LEFT;
      } else if (ltInward && rtOutward) {
        disease = PRECISE_DISEASES.FOOT_RIGHT;
      } else if (ltOutward && rtOutward) {
        disease = PRECISE_DISEASES.FOOT_OUTWARD;
      } else if (ltInward && rtInward) {
        disease = PRECISE_DISEASES.FOOT_INWARD;
      } else if (ltNormal && rtInward) {
        disease = PRECISE_DISEASES.RIGHT_FOOT_INWARD;
      } else if (ltNormal && rtOutward) {
        disease = PRECISE_DISEASES.RIGHT_FOOT_OUTWARD;
      } else if (ltInward && rtNormal) {
        disease = PRECISE_DISEASES.LEFT_FOOT_INWARD;
      } else if (ltOutward && rtNormal) {
        disease = PRECISE_DISEASES.LEFT_FOOT_OUTWARD;
      }

      score = Math.ceil((leftFootResult.score + rightFootResult.score) / 2);
    }

    return {
      result: representative,
      ltAngle,
      rtAngle,
      score,
      disease,
    };
  }
  private checkLeftFoot(leftKnee: Point, leftAnkle: Point, leftFoot: Point) {
    // 정면(end_front) 비미러 기준: LEFT 신체 = 이미지 우측. 안쪽(body center) = 왼쪽(−x 방향)
    // 왼발: footIndex가 ankle보다 왼쪽(−x, 몸 중심 방향)이면 inward (음수)
    //        footIndex가 ankle보다 오른쪽(+x, 바깥 방향)이면 outward (양수)
    const signedAngle = this.calcAngleFromVerticalSigned(leftAnkle, leftFoot, 'left');
    const absAngle = Math.abs(signedAngle);
    const levelMapping = [
      { max: 5, score: 1 },
      { max: 10, score: 2 },
      { max: 15, score: 3 },
      { max: 20, score: 4 },
      { max: Infinity, score: 5 },
    ];
    const isNormal = signedAngle >= 0 && signedAngle < 5;
    const level = isNormal ? { score: 1 } : levelMapping.find((item) => absAngle <= item.max) || { score: 5 };
    return {
      result: signedAngle,
      signedAngle,
      score: level.score,
      disease:
        level.score === 1
          ? 'NORMAL'
          : signedAngle < 0
          ? PRECISE_DISEASES.LEFT_FOOT_INWARD
          : PRECISE_DISEASES.LEFT_FOOT_OUTWARD,
    };
  }
  private checkRightFoot(rightKnee: Point, rightAnkle: Point, rightFoot: Point) {
    // 정면(end_front) 비미러 기준: RIGHT 신체 = 이미지 좌측. 안쪽(body center) = 오른쪽(+x 방향)
    // 오른발: footIndex가 ankle보다 오른쪽(+x, 몸 중심 방향)이면 inward (음수)
    //         footIndex가 ankle보다 왼쪽(−x, 바깥 방향)이면 outward (양수)
    const signedAngle = this.calcAngleFromVerticalSigned(rightAnkle, rightFoot, 'right');
    const absAngle = Math.abs(signedAngle);
    const levelMapping = [
      { max: 5, score: 1 },
      { max: 10, score: 2 },
      { max: 15, score: 3 },
      { max: 20, score: 4 },
      { max: Infinity, score: 5 },
    ];
    const isNormal = signedAngle >= 0 && signedAngle < 5;
    const level = isNormal ? { score: 1 } : levelMapping.find((item) => absAngle <= item.max) || { score: 5 };
    return {
      result: signedAngle,
      signedAngle,
      score: level.score,
      disease:
        level.score === 1
          ? 'NORMAL'
          : signedAngle < 0
          ? PRECISE_DISEASES.RIGHT_FOOT_INWARD
          : PRECISE_DISEASES.RIGHT_FOOT_OUTWARD,
    };
  }

  private checkKnees(
    leftHip: Point,
    leftKnee: Point,
    leftAnkle: Point,
    rightHip: Point,
    rightKnee: Point,
    rightAnkle: Point,
  ) {
    const leftKneeResult = this.checkLeftKnee(leftHip, leftKnee, leftAnkle);
    const rightKneeResult = this.checkRightKnee(rightHip, rightKnee, rightAnkle);

    // 각각의 상태: inward(안쪽 모임, >185°), outward(바깥 벌어짐, <175°), normal(175~185°)
    const ltIn  = leftKneeResult.innerAngle > 185;
    const ltOut = leftKneeResult.innerAngle < 175;
    const ltNml = !ltIn && !ltOut;
    const rtIn  = rightKneeResult.innerAngle > 185;
    const rtOut = rightKneeResult.innerAngle < 175;
    const rtNml = !rtIn && !rtOut;

    let disease = 'NORMAL';
    if (ltIn && rtIn) {
      disease = PRECISE_DISEASES.KNEE_INWARD;
    } else if (ltOut && rtOut) {
      disease = PRECISE_DISEASES.KNEE_OUTWARD;
    } else if (rtIn && ltOut) {
      disease = PRECISE_DISEASES.KNEE_RIGHT;   // 오른쪽 안쪽 / 왼쪽 바깥
    } else if (rtOut && ltIn) {
      disease = PRECISE_DISEASES.KNEE_LEFT;    // 오른쪽 바깥 / 왼쪽 안쪽
    } else if (rtIn && ltNml) {
      disease = PRECISE_DISEASES.RIGHT_KNEE_INWARD;
    } else if (rtOut && ltNml) {
      disease = PRECISE_DISEASES.RIGHT_KNEE_OUTWARD;
    } else if (ltIn && rtNml) {
      disease = PRECISE_DISEASES.LEFT_KNEE_INWARD;
    } else if (ltOut && rtNml) {
      disease = PRECISE_DISEASES.LEFT_KNEE_OUTWARD;
    }

    return {
      result: (leftKneeResult.innerAngle + rightKneeResult.innerAngle) / 2,
      leftInnerAngle: leftKneeResult.innerAngle,
      rightInnerAngle: rightKneeResult.innerAngle,
      score: Math.ceil((leftKneeResult.score + rightKneeResult.score) / 2),
      disease,
    };
  }
  private checkLeftKnee(leftHip: Point, leftKnee: Point, leftAnkle: Point) {
    // hip-knee-ankle "안쪽" 각도: 무조건 안쪽(몸 중심 방향) 기준
    // 이미지 좌표계: y축이 아래 방향. 안쪽 = 오른쪽(+x 방향)
    const innerAngle = this.calcInnerKneeAngle(leftHip, leftKnee, leftAnkle, 'left');
    const diff = Math.abs(innerAngle - 180);
    const levelMapping = [
      { max: 5, score: 1 },
      { max: 10, score: 2 },
      { max: 15, score: 3 },
      { max: 20, score: 4 },
      { max: Infinity, score: 5 },
    ];
    const isNormal = innerAngle >= 175 && innerAngle <= 185;
    const level = isNormal ? { score: 1 } : levelMapping.find((item) => diff <= item.max) || { score: 5 };
    return {
      result: innerAngle,
      innerAngle,
      score: level.score,
      disease:
        level.score === 1
          ? 'NORMAL'
          : innerAngle > 185
          ? PRECISE_DISEASES.LEFT_KNEE_INWARD
          : PRECISE_DISEASES.LEFT_KNEE_OUTWARD,
    };
  }
  private checkRightKnee(rightHip: Point, rightKnee: Point, rightAnkle: Point) {
    const innerAngle = this.calcInnerKneeAngle(rightHip, rightKnee, rightAnkle, 'right');
    const diff = Math.abs(innerAngle - 180);
    const levelMapping = [
      { max: 5, score: 1 },
      { max: 10, score: 2 },
      { max: 15, score: 3 },
      { max: 20, score: 4 },
      { max: Infinity, score: 5 },
    ];
    const isNormal = innerAngle >= 175 && innerAngle <= 185;
    const level = isNormal ? { score: 1 } : levelMapping.find((item) => diff <= item.max) || { score: 5 };
    return {
      result: innerAngle,
      innerAngle,
      score: level.score,
      disease:
        level.score === 1
          ? 'NORMAL'
          : innerAngle > 185
          ? PRECISE_DISEASES.RIGHT_KNEE_INWARD
          : PRECISE_DISEASES.RIGHT_KNEE_OUTWARD,
    };
  }

  private checkAnkle(leftHeel: Point, leftAnkle: Point, rightHeel: Point, rightAnkle: Point) {
    const leftAnkleResult = this.checkLeftAnkle(leftHeel, leftAnkle);
    const rightAnkleResult = this.checkRightAnkle(rightHeel, rightAnkle);
    let disease = 'NORMAL';
    if (
      leftAnkleResult.disease == PRECISE_DISEASES.LEFT_ANKLE_OUTWARD &&
      rightAnkleResult.disease == PRECISE_DISEASES.RIGHT_ANKLE_INWARD
    ) {
      disease = PRECISE_DISEASES.ANKLE_LEFT;
    } else if (
      leftAnkleResult.disease == PRECISE_DISEASES.LEFT_ANKLE_INWARD &&
      rightAnkleResult.disease == PRECISE_DISEASES.RIGHT_ANKLE_OUTWARD
    ) {
      disease = PRECISE_DISEASES.ANKLE_RIGHT;
    } else if (
      leftAnkleResult.disease == PRECISE_DISEASES.LEFT_ANKLE_INWARD &&
      rightAnkleResult.disease == PRECISE_DISEASES.RIGHT_ANKLE_INWARD
    ) {
      disease = PRECISE_DISEASES.ANKLE_INWARD;
    } else if (
      leftAnkleResult.disease == PRECISE_DISEASES.LEFT_ANKLE_OUTWARD &&
      rightAnkleResult.disease == PRECISE_DISEASES.RIGHT_ANKLE_OUTWARD
    ) {
      disease = PRECISE_DISEASES.ANKLE_OUTWARD;
    } else if (rightAnkleResult.disease == PRECISE_DISEASES.RIGHT_ANKLE_OUTWARD) {
      disease = PRECISE_DISEASES.RIGHT_ANKLE_OUTWARD;
    } else if (rightAnkleResult.disease == PRECISE_DISEASES.RIGHT_ANKLE_INWARD) {
      disease = PRECISE_DISEASES.RIGHT_ANKLE_INWARD;
    } else if (leftAnkleResult.disease == PRECISE_DISEASES.LEFT_ANKLE_OUTWARD) {
      disease = PRECISE_DISEASES.LEFT_ANKLE_OUTWARD;
    } else if (leftAnkleResult.disease == PRECISE_DISEASES.LEFT_ANKLE_INWARD) {
      disease = PRECISE_DISEASES.LEFT_ANKLE_INWARD;
    }
    return {
      result: (leftAnkleResult.result + rightAnkleResult.result) / 2,
      leftAnkleAlignmentAngle: leftAnkleResult.leftAnkleAlignmentAngle,
      rightAnkleAlignmentAngle: rightAnkleResult.rightAnkleAlignmentAngle,
      score: Math.ceil((leftAnkleResult.score + rightAnkleResult.score) / 2),
      disease: disease,
    };
  }
  private checkLeftAnkle(leftHeel: Point, leftAnkle: Point) {
    // leftAnkleAlignmentAngle: heel 기준 수직선과 heel→ankle 벡터 사이 각도
    // 정상 범위: -16° ≤ angle ≤ -7°
    // inversion(안쪽 과도): angle < -16°, eversion(바깥 무너짐): angle > -7°
    const dx = leftAnkle.x - leftHeel.x;
    const dy = leftAnkle.y - leftHeel.y;
    const leftAnkleAlignmentAngle = Math.floor(Math.atan2(dx, -dy) * (180 / Math.PI));

    const NORMAL_MIN = -16;
    const NORMAL_MAX = -7;
    const isNormal = leftAnkleAlignmentAngle >= NORMAL_MIN && leftAnkleAlignmentAngle <= NORMAL_MAX;

    // 정상 범위 이탈 정도: inversion=음수, eversion=양수, 정상=0
    const deviation = leftAnkleAlignmentAngle < NORMAL_MIN
      ? leftAnkleAlignmentAngle - NORMAL_MIN
      : leftAnkleAlignmentAngle > NORMAL_MAX
      ? leftAnkleAlignmentAngle - NORMAL_MAX
      : 0;

    const absDeviation = Math.abs(deviation);
    const levelMapping = [
      { max: 5, score: 2 },
      { max: 10, score: 3 },
      { max: 15, score: 4 },
      { max: Infinity, score: 5 },
    ];
    const level = isNormal ? { score: 1 } : levelMapping.find((item) => absDeviation <= item.max) || { score: 5 };
    return {
      result: deviation,
      leftAnkleAlignmentAngle,
      score: level.score,
      disease: isNormal
        ? 'NORMAL'
        : deviation < 0
        ? PRECISE_DISEASES.LEFT_ANKLE_INWARD    // inversion
        : PRECISE_DISEASES.LEFT_ANKLE_OUTWARD,  // eversion
    };
  }
  private checkRightAnkle(rightHeel: Point, rightAnkle: Point) {
    // rightAnkleAlignmentAngle: heel 기준 수직선과 heel→ankle 벡터 사이 각도
    // 후면 카메라(end_back) 비미러: image right = 사람의 오른쪽
    // 오른쪽 inversion = ankle이 heel보다 오른쪽(높은 x, dx>0)
    // → dx를 반전하여 왼쪽과 동일하게 inversion=음수, eversion=양수로 통일
    // 정상 범위: -16° ≤ angle ≤ -7°
    const dx = -(rightAnkle.x - rightHeel.x);
    const dy = rightAnkle.y - rightHeel.y;
    const rightAnkleAlignmentAngle = Math.floor(Math.atan2(dx, -dy) * (180 / Math.PI));

    const NORMAL_MIN = -16;
    const NORMAL_MAX = -7;
    const isNormal = rightAnkleAlignmentAngle >= NORMAL_MIN && rightAnkleAlignmentAngle <= NORMAL_MAX;

    // 정상 범위 이탈 정도: inversion=음수, eversion=양수, 정상=0
    const deviation = rightAnkleAlignmentAngle < NORMAL_MIN
      ? rightAnkleAlignmentAngle - NORMAL_MIN
      : rightAnkleAlignmentAngle > NORMAL_MAX
      ? rightAnkleAlignmentAngle - NORMAL_MAX
      : 0;

    const absDeviation = Math.abs(deviation);
    const levelMapping = [
      { max: 5, score: 2 },
      { max: 10, score: 3 },
      { max: 15, score: 4 },
      { max: Infinity, score: 5 },
    ];
    const level = isNormal ? { score: 1 } : levelMapping.find((item) => absDeviation <= item.max) || { score: 5 };
    return {
      result: deviation,
      rightAnkleAlignmentAngle,
      score: level.score,
      disease: isNormal
        ? 'NORMAL'
        : deviation < 0
        ? PRECISE_DISEASES.RIGHT_ANKLE_INWARD    // inversion
        : PRECISE_DISEASES.RIGHT_ANKLE_OUTWARD,  // eversion
    };
  }
  private checkHipHigher(leftHip: Point, rightHip: Point, leftHeel: Point, rightHeel: Point) {
    // hipBalanceAngle: LeftHip → RightHip 연결선의 수평 대비 기울기 각도
    // dx를 rightHip.x - leftHip.x로 설정해야 end_back 뷰에서 양수가 되어 ~0° 기준으로 올바르게 계산됨
    const dx = rightHip.x - leftHip.x;
    const dy = leftHip.y - rightHip.y;
    const hipBalanceAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    // 양수 = RightHip이 더 높음, 음수 = LeftHip이 더 높음

    const heelMid = leftHeel && rightHeel
      ? { x: (rightHeel.x + leftHeel.x) / 2, y: (rightHeel.y + leftHeel.y) / 2 }
      : null;

    // 사진 tooltip(좌·우 엉덩이 각도)과 동일하게 정수 반올림 각도로 판정
    const displayAngle = Math.round(Math.abs(hipBalanceAngle));
    const levelMapping = [
      { max: OVERHEAD_SQUAT.HIP_HEIGHT_NORMAL_MAX_ROUNDED_DEG, score: 1 },
      { max: 10, score: 2 },
      { max: 15, score: 3 },
      { max: 20, score: 4 },
      { max: Infinity, score: 5 },
    ];
    const level = levelMapping.find((item) => displayAngle <= item.max) || { score: 1 };
    return {
      result: hipBalanceAngle,
      hipBalanceAngle,
      heelMid,
      score: level.score,
      disease:
        level.score == 1
          ? 'NORMAL'
          : hipBalanceAngle > 0
          ? PRECISE_DISEASES.RIGHT_HIP_HIGHER
          : PRECISE_DISEASES.LEFT_HIP_HIGHER,
    };
  }
  private checkArm(
    leftElbow: Point,
    leftShoulder: Point,
    leftHip: Point,
    rightElbow: Point,
    rightShoulder: Point,
    rightHip: Point,
  ) {
    // 팔 위치: shoulder를 꼭짓점으로 shoulder→elbow와 shoulder→hip 벡터 사이 각도
    // 팔이 올라갈수록 180°에 가까워짐. 어깨 각도는 180° 초과가 불가하므로 calculateAngle 직접 사용
    // 정상 기준: ≥ 152°. 152° 이상은 180°로 보정 표시, 미만은 0~152 → 0~180 비율 환산
    const NORMAL_THRESHOLD = 152;
    // landmark 미검출(undefined/null) 또는 좌표 불량(NaN)인 경우 NaN 처리
    const leftRaw = (leftShoulder && leftElbow && leftHip)
      ? calculateAngle(leftShoulder, leftElbow, leftHip)
      : NaN;
    const rightRaw = (rightShoulder && rightElbow && rightHip)
      ? calculateAngle(rightShoulder, rightElbow, rightHip)
      : NaN;

    // 표시용 보정각: ≥152° → 180, <152° → raw * (180/152), 미검출(NaN) → 180(정상 표시)
    const leftAngle = !Number.isFinite(leftRaw) ? 180 : leftRaw >= NORMAL_THRESHOLD ? 180 : Math.round(leftRaw * (180 / NORMAL_THRESHOLD) * 100) / 100;
    const rightAngle = !Number.isFinite(rightRaw) ? 180 : rightRaw >= NORMAL_THRESHOLD ? 180 : Math.round(rightRaw * (180 / NORMAL_THRESHOLD) * 100) / 100;

    // 정상 판정·심각도: 보정각 기준 ≥152° (원시각이 아닌 표시 보정각 사용)
    const ltNormal = !Number.isFinite(leftRaw) || leftAngle >= NORMAL_THRESHOLD;
    const rtNormal = !Number.isFinite(rightRaw) || rightAngle >= NORMAL_THRESHOLD;

    let disease = 'NORMAL';
    if (!ltNormal && !rtNormal) {
      disease = PRECISE_DISEASES.ARM_UNNORMAL;
    } else if (!ltNormal) {
      disease = PRECISE_DISEASES.LEFT_ARM_UNNORMAL;
    } else if (!rtNormal) {
      disease = PRECISE_DISEASES.RIGHT_ARM_UNNORMAL;
    }

    const avg = (leftAngle + rightAngle) / 2;
    const levelMapping = [
      { max: 5, score: 1 },
      { max: 10, score: 2 },
      { max: 15, score: 3 },
      { max: 20, score: 4 },
      { max: Infinity, score: 5 },
    ];
    const leftDef = Number.isFinite(leftRaw) ? Math.max(NORMAL_THRESHOLD - leftAngle, 0) : 0;
    const rightDef = Number.isFinite(rightRaw) ? Math.max(NORMAL_THRESHOLD - rightAngle, 0) : 0;
    const deficiency = Math.max(leftDef, rightDef);
    const level = deficiency === 0 ? { score: 1 } : levelMapping.find((item) => deficiency <= item.max) || { score: 5 };

    return {
      result: avg,
      leftAngle,
      rightAngle,
      leftShoulderFlexionAngle: leftAngle,
      rightShoulderFlexionAngle: rightAngle,
      score: level.score,
      disease: level.score === 1 ? 'NORMAL' : disease,
    };
  }
  private checkBody(
    rightKnee: Point, rightAnkle: Point, rightHip: Point, rightShoulder: Point,
    leftKnee: Point, leftAnkle: Point, leftHip: Point, leftShoulder: Point,
  ) {
    // trunkLeanAngle: 상체(hip→shoulder) vs 하체(ankle→knee) 수직 대비 기울기 차이 (도)
    // end_right 뷰에서 양수 = 상체가 하체보다 더 앞으로 기울어짐(FORWARD)
    // QA 스펙: legAngle(바닥-ankle-knee 각) vs trunkAngle(shoulder-hip-바닥 각) 비교
    // rightTrunkLeanAngle > 0 → FORWARD, < 0 → BACKWARD
    const rightTrunkLeanAngle = this.calcTrunkLeanAngle(rightHip, rightShoulder, rightAnkle, rightKnee);
    const leftTrunkLeanAngle = this.calcTrunkLeanAngle(leftHip, leftShoulder, leftAnkle, leftKnee);

    const absAngle = Math.abs(rightTrunkLeanAngle);
    const levelMapping = [
      { max: 5, score: 1 },
      { max: 10, score: 2 },
      { max: 15, score: 3 },
      { max: 20, score: 4 },
      { max: 180, score: 5 },
    ];
    const level = levelMapping.find((item) => absAngle <= item.max) || { score: 5 };

    return {
      result: rightTrunkLeanAngle,
      rightTrunkLeanAngle,
      leftTrunkLeanAngle,
      score: level.score,
      disease:
        level.score === 1
          ? 'NORMAL'
          : rightTrunkLeanAngle > 0
          ? PRECISE_DISEASES.BODY_LEARN_FORWARD
          : PRECISE_DISEASES.BODY_LEARN_BACKWARD,
    };
  }

  /** 상체(hip→shoulder) vs 하체(ankle→knee) 수직 대비 기울기 차이 (도) */
  private calcTrunkLeanAngle(hip: Point, shoulder: Point, ankle: Point, knee: Point): number {
    if (!hip || !shoulder || !ankle || !knee) return 0;
    const trunkAngle = Math.atan2(shoulder.x - hip.x, -(shoulder.y - hip.y)) * (180 / Math.PI);
    const legAngle = Math.atan2(knee.x - ankle.x, -(knee.y - ankle.y)) * (180 / Math.PI);
    return trunkAngle - legAngle;
  }
  private checkHeel(leftHeel: Point, leftFoot: Point, leftAnkle: Point, rightHeel: Point, rightFoot: Point, rightAnkle: Point) {
    // ankleDorsiflexionAngle: Ankle→FootIndex 벡터와 수평선 사이 각도
    const rightAnkleDorsiflexionAngle = rightAnkle && rightFoot
      ? Math.atan2(rightFoot.y - rightAnkle.y, rightFoot.x - rightAnkle.x) * (180 / Math.PI)
      : 0;
    const leftAnkleDorsiflexionAngle = leftAnkle && leftFoot
      ? Math.atan2(leftFoot.y - leftAnkle.y, leftFoot.x - leftAnkle.x) * (180 / Math.PI)
      : 0;

    const measuredLeftNormal = leftHeel && leftFoot && leftHeel.y > leftFoot.y;
    const measuredRightNormal = rightHeel && rightFoot && rightHeel.y > rightFoot.y;
    const isNormal = measuredLeftNormal && measuredRightNormal;
    const result = (leftHeel.y - leftFoot.y + rightHeel.y - rightFoot.y) / 2;
    const levelMapping = [
      { max: 5, score: 1 },
      { max: 10, score: 2 },
      { max: 15, score: 3 },
      { max: 20, score: 4 },
      { max: Infinity, score: 5 },
    ];
    const level = levelMapping.find((item) => Math.abs(result) <= item.max) || { score: 1 };
    let disease: string = 'NORMAL';
    if (!isNormal && level.score > 1) {
      if (!measuredLeftNormal && !measuredRightNormal) {
        disease = PRECISE_DISEASES.HEEL_UNNORMAL;
      } else if (!measuredLeftNormal) {
        disease = PRECISE_DISEASES.LEFT_HEEL_UNNORMAL;
      } else {
        disease = PRECISE_DISEASES.RIGHT_HEEL_UNNORMAL;
      }
    }
    return {
      result: isNormal ? 1 : 0,
      leftNormal: measuredLeftNormal,
      rightNormal: measuredRightNormal,
      rightAnkleDorsiflexionAngle,
      leftAnkleDorsiflexionAngle,
      score: isNormal ? 1 : level.score,
      disease,
    };
  }

  /**
   * ankle → tip 연결선과 수직선 사이 각도 (부호 포함).
   * innerSide: 몸의 중심 방향. 'right' = +x 방향이 내측(왼발), 'left' = -x 방향이 내측(오른발).
   * tip이 innerSide 방향으로 가면 마이너스(inward), 반대로 가면 플러스(outward).
   */
  private calcAngleFromVerticalSigned(
    base: Point,
    tip: Point,
    innerSide: 'right' | 'left',
  ): number {
    // dx > 0: tip이 오른쪽, dx < 0: tip이 왼쪽
    const dx = tip.x - base.x;
    const dy = base.y - tip.y; // 이미지 좌표계 y축 반전: 위로 갈수록 y 감소
    // 수직선 대비 각도 (절대값)
    const angleDeg = Math.atan2(Math.abs(dx), Math.abs(dy)) * (180 / Math.PI);
    // 부호: innerSide 방향으로 tip이 이동하면 음수
    const isInward = innerSide === 'right' ? dx > 0 : dx < 0;
    return isInward ? -angleDeg : angleDeg;
  }

  /**
   * hip-knee-ankle의 "안쪽" 각도 계산.
   * 이미지 좌표계(y↓)에서 안쪽 = 몸 중심 방향.
   * calculateAngle는 항상 0~180° 반환하므로, knee가 안쪽으로 무너지면 >180°가 되는 방향을 부호로 처리.
   * side: 'left' → 안쪽 = +x(오른쪽), 'right' → 안쪽 = -x(왼쪽).
   */
  private calcInnerKneeAngle(
    hip: Point,
    knee: Point,
    ankle: Point,
    side: 'left' | 'right',
  ): number {
    const baseAngle = calculateAngle(knee, hip, ankle);
    // knee가 hip-ankle 연결선 기준으로 안쪽(중심 방향)에 있으면 valgus(>180°)
    // 정면 비미러: person's left = image right (높은 x), person's right = image left (낮은 x)
    // hip.x만 비교하면 발목이 크게 벌어진 경우 오판 → hip-ankle 직선 보간값과 비교
    const t = ankle.y === hip.y ? 0.5 : (knee.y - hip.y) / (ankle.y - hip.y);
    const expectedKneeX = hip.x + t * (ankle.x - hip.x);
    // 왼쪽: 안쪽(center) = 낮은 x → knee.x < expectedKneeX 이면 valgus
    // 오른쪽: 안쪽(center) = 높은 x → knee.x > expectedKneeX 이면 valgus
    const isValgus = side === 'left' ? knee.x < expectedKneeX : knee.x > expectedKneeX;
    return isValgus ? 180 + (180 - baseAngle) : baseAngle;
  }
}
