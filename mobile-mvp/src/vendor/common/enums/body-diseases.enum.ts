export enum BODY_DISEASES {
  // ── 발목 ──────────────────────────────────────────────────────────────
  ANKLE_MOVE_OUTWARD = 'ANKLE_MOVE_OUTWARD',   // 발목 외측 이동
  ANKLE_MOVE_INWARD = 'ANKLE_MOVE_INWARD',     // 발목 내측 이동

  // ── 발 ───────────────────────────────────────────────────────────────
  ARCHED_FEET = 'ARCHED_FEET',                 // 오목발
  FLAT_FEET = 'FLAT_FEET',                     // 평발

  // ── 등 ───────────────────────────────────────────────────────────────
  FLAT_BACK = 'FLAT_BACK',                     // 평편등
  HUNCHED_BACK = 'HUNCHED_BACK',               // 굽은등

  // ── 고관절/다리 회전 ────────────────────────────────────────────────
  LEGS_TURNED_OUTWARD = 'LEGS_TURNED_OUTWARD', // 다리 외회전
  LEGS_TURNED_INWARD = 'LEGS_TURNED_INWARD',   // 다리 내회전

  // ── 무릎 ─────────────────────────────────────────────────────────────
  BENT_KNEES = 'BENT_KNEES',                   // 굽힌 무릎
  BACK_KNEES = 'BACK_KNEES',                   // 뒤로 빠진 무릎
  BOW_LEGS = 'BOW_LEGS',                       // O다리
  KNOCK_LEGS = 'KNOCK_LEGS',                   // X다리

  // ── 목 ───────────────────────────────────────────────────────────────
  NECK_TILT = 'NECK_TILT',                     // 목 기울임
  NECK_ROTATION = 'NECK_ROTATION',             // 목 회전
  TURTLE_NECK = 'TURTLE_NECK',                 // 거북목
  RAISED_NECK = 'RAISED_NECK',                 // 들임목
  STRAIGHT_NECK = 'STRAIGHT_NECK',             // 일자목

  // ── 골반 ─────────────────────────────────────────────────────────────
  PELVIS_ROTATION_LEFT = 'PELVIS_ROTATION_LEFT',   // 골반 좌측 회전
  PELVIS_ROTATION_RIGHT = 'PELVIS_ROTATION_RIGHT', // 골반 우측 회전
  PELVIS_TILTS_FORWARD = 'PELVIS_TILTS_FORWARD',   // 골반 전방 기울임
  PELVIS_TILTS_BACKWARD = 'PELVIS_TILTS_BACKWARD', // 골반 후방 기울임
  SWAY_BACK = 'SWAY_BACK',                         // 스웨이백
  PELVIS_MOVE_RIGHT = 'PELVIS_MOVE_RIGHT',          // 골반 우측 이동
  PELVIS_MOVE_LEFT = 'PELVIS_MOVE_LEFT',            // 골반 좌측 이동
  PELVIS_ASYMMETRY = 'PELVIS_ASYMMETRY',            // 골반 비대칭

  // ── 어깨 ─────────────────────────────────────────────────────────────
  ROUNDED_SHOULDER = 'ROUNDED_SHOULDER',           // 라운드 어깨
  RAISED_SHOULDER = 'RAISED_SHOULDER',             // 올라간 어깨
  DROPPED_SHOULDER = 'DROPPED_SHOULDER',           // 처진 어깨
  SHOULDER_HEIGHT_ASYMMETRY = 'SHOULDER_HEIGHT_ASYMMETRY', // 어깨 높이 비대칭
  STRAIGHT_SHOULDER = 'STRAIGHT_SHOULDER',         // 스트레이트 어깨

  // ── 몸통 ─────────────────────────────────────────────────────────────
  TORSO_ROTATION_LEFT = 'TORSO_ROTATION_LEFT',     // 몸통 좌측 회전
  TORSO_ROTATION_RIGHT = 'TORSO_ROTATION_RIGHT',   // 몸통 우측 회전
  TORSO_TILTED_RIGHT = 'TORSO_TILTED_RIGHT',       // 몸통 우측 기울임
  TORSO_TILTED_LEFT = 'TORSO_TILTED_LEFT',         // 몸통 좌측 기울임

  // ── 팔꿈치/팔 ────────────────────────────────────────────────────────
  BENT_ELBOW = 'BENT_ELBOW',                       // 굽힌 팔꿈치
  EXTENDED_ELBOW = 'EXTENDED_ELBOW',               // 과신전 팔꿈치
  ARMS_TURNED_IN = 'ARMS_TURNED_IN',               // 팔 내회전
  ARMS_TURNED_OUT = 'ARMS_TURNED_OUT',             // 팔 외회전
}
