import { BODY_DISEASES } from '../../common/enums/body-diseases.enum';
import { VIDEO_LEVEL } from '../../common/enums/video.enum';

export interface Point {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface Landmarks {
  front?: Record<string, Point>;
  back?: Record<string, Point>;
  right_side?: Record<string, Point>;
  left_side?: Record<string, Point>;
  [key: string]: any; // 유연성을 위해 추가
}

export interface DiseaseResult {
  key: BODY_DISEASES | string;
  level: VIDEO_LEVEL | string;
  score: number;
}

export interface AnalysisResponse {
  max: number | string;
  score: number;
  scoreUsage: number;
  disease: BODY_DISEASES | string;
  scoreMapping?: any[];
  result: string;
}

export interface ScoreDetail {
  neck?: any;
  back?: any;
  shoulder?: any;
  knee?: any;
  pelvis?: any;
  lowerLimbAlignment?: any;
  upperArm?: any;
  torso?: any;
  hipJoint?: any;
  ankle?: any;
  balanceIndex?: any;
  [key: string]: any;
}

export interface ScoreMap {
  max: number;
  score: number;
  scoreUsage: number;
  disease: string;
}
