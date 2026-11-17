/**
 * 분석 전략 공통 임계값 상수
 *
 * 카메라 방향 규약:
 *   - 정면 촬영: 인체 오른쪽 = 화면 왼쪽 = 작은 X  (Rt_hip.x < Lt_hip.x)
 *   - 후면 촬영: 인체 오른쪽 = 화면 오른쪽 = 큰 X  (Rt_hip.x > Lt_hip.x)
 *   - 측면 촬영: X축 = 전후 방향
 */

/** 척추정렬검사 */
export const SPINAL_ALIGNMENT = {
  /** 상체 중심 이동 (centerShoulderHip) 정상 임계값 [px] */
  TILT_THRESHOLD_PX: 0.3,
  /** 어깨 윤곽 도드라짐 (shoulderContour diff) 정상 임계값 [px] */
  CONTOUR_THRESHOLD_PX: 0,
  /** 다리 사용 (legUsage dx) 정상 임계값 [px] */
  LEG_USAGE_THRESHOLD_PX: 0,
  /** 어깨 높이 차이 (higherShoulder) 정상 임계값 [px] */
  SHOULDER_HEIGHT_THRESHOLD_PX: 0,
  /** 골반 기울기 (pelvicReaction) 정상 임계값 [degrees] */
  PELVIC_ANGLE_THRESHOLD_DEG: 1,
} as const;

/** 균형감각검사 */
export const BALANCE_ALIGNMENT = {
  /** 정면 골반 높이 대칭 정상 하한 [degrees] */
  FRONT_HIP_NORMAL_MIN_DEG: 2,
  /** 정면 골반 높이 대칭 정상 상한 [degrees] */
  FRONT_HIP_NORMAL_MAX_DEG: 10,
  /** 정면 골반 높이 대칭 과도(상승) 시작 [degrees] */
  FRONT_HIP_OVER_MIN_DEG: 11,
  /** 지지다리 distKnee = distAnkle 판정 허용 오차 [px] */
  SUPPORTING_LEG_DIST_EQUAL_EPSILON_PX: 1,
  /** 지지다리 Angle_HKA 정상 하한 [degrees] */
  SUPPORTING_LEG_ANGLE_NORMAL_MIN: 173,
  /** 지지다리 Angle_HKA 정상 상한 [degrees] */
  SUPPORTING_LEG_ANGLE_NORMAL_MAX: 185,
} as const;

/** 전신기능검사 (오버헤드 스쿼트) */
export const OVERHEAD_SQUAT = {
  /**
   * 발 방향 정렬 정상 하한 [degrees]
   * 대표값 = max(|왼발|, |오른발|) 수직선 이탈 각도
   */
  FOOT_DIRECTION_NORMAL_MIN_DEG: 19,
  /**
   * 발 방향 정렬 정상 상한 [degrees]
   */
  FOOT_DIRECTION_NORMAL_MAX_DEG: 29,
  /** 비정상 시 좌·우 발별 outward 판정 하한 [degrees] (질병 세분화용) */
  FOOT_PER_SIDE_OUTWARD_MIN_DEG: 5,
  /**
   * 골반 좌우 높이(hipHigher) 정상 상한 [degrees]
   * 사진 tooltip과 동일하게 Math.round(|각도|) 기준으로 판정
   */
  HIP_HEIGHT_NORMAL_MAX_ROUNDED_DEG: 0,
} as const;
