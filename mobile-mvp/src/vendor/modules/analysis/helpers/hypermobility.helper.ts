/**
 * 과가동성(Hypermobility) 단계 판별 헬퍼
 *
 * 각 관절의 측정값이 정상 범위를 초과했을 때
 * 초과량(excess)과 단계 기준표(stages)를 바탕으로 단계명을 반환합니다.
 *
 * @param excess  - normalAngle 초과분 (angle - normalAngle)
 * @param stages  - [[초과량 기준, 단계명], ...] 오름차순 배열
 * @returns 단계명 ('경미'|'주의'|'심각'|'매우심각') 또는 null (과가동 없음)
 */
export function getHypermobilityLevel(
  excess: number,
  stages: [number, string][],
): string | null {
  if (excess <= 0) return null;
  let result: string | null = null;
  for (const [threshold, level] of stages) {
    if (excess >= threshold) result = level;
  }
  return result;
}

/**
 * 과가동성 단계 기준표
 *
 * 문서: 관절가동범위_보정로직_전달문서_최종.md  B. 과가동성 단계 적용 항목
 */
export const HYPER_STAGES = {
  /** 목 굽힘/폄: 단위 1°, +2부터 시작 */
  NECK: [[2, '경미'], [3, '주의'], [4, '심각'], [5, '매우심각']] as [number, string][],

  /** 어깨 벌림·굽힘: 단위 3°, +3부터 시작 */
  SHOULDER_LARGE: [[3, '경미'], [6, '주의'], [9, '심각'], [12, '매우심각']] as [number, string][],

  /** 어깨 모음·폄·안쪽돌림·가쪽돌림: 단위 2°, +2부터 시작 */
  SHOULDER_SMALL: [[2, '경미'], [4, '주의'], [6, '심각'], [8, '매우심각']] as [number, string][],

  /** 팔꿈치 굽힘·폄: 단위 1°, +1부터 시작 */
  ELBOW: [[1, '경미'], [2, '주의'], [3, '심각'], [4, '매우심각']] as [number, string][],

  /** 몸통 가쪽굽힘: 단위 2°, 심각 기준 +8(문서상 +6~+8 구간 미기재) */
  TORSO_LATERAL: [[2, '경미'], [4, '주의'], [8, '심각'], [10, '매우심각']] as [number, string][],

  /** 몸통 굽힘: 단위 3°, +3부터 시작 */
  TORSO_FLEX: [[3, '경미'], [6, '주의'], [9, '심각'], [12, '매우심각']] as [number, string][],

  /** 엉덩관절 벌림·가쪽돌림: 단위 3° */
  HIP_LARGE: [[3, '경미'], [6, '주의'], [9, '심각'], [12, '매우심각']] as [number, string][],

  /** 엉덩관절 모음: 문서상 특수 기준 */
  HIP_ADD: [[3, '경미'], [6, '주의'], [8, '심각'], [11, '매우심각']] as [number, string][],

  /** 엉덩관절 안쪽돌림: 단위 2° */
  HIP_SMALL: [[2, '경미'], [4, '주의'], [6, '심각'], [8, '매우심각']] as [number, string][],

  /** 엉덩관절 굽힘·폄: 문서상 특수 기준(+9~+10 구간 미기재) */
  HIP_FLEX_EXT: [[3, '경미'], [6, '주의'], [10, '심각'], [13, '매우심각']] as [number, string][],

  /** 무릎 굽힘: 단위 1°, +2부터 시작 */
  KNEE_FLEX: [[2, '경미'], [3, '주의'], [4, '심각'], [5, '매우심각']] as [number, string][],

  /** 무릎 폄: 단위 1°, +1부터 시작 */
  KNEE_EXT: [[1, '경미'], [2, '주의'], [3, '심각'], [4, '매우심각']] as [number, string][],
} as const;
