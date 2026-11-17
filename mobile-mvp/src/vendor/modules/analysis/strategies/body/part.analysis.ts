import { DiseaseResult, Landmarks, ScoreDetail } from '../../analysis.types';

export interface PartAnalysis {
  score: number;
  disease: DiseaseResult[];
  scoreDetail: ScoreDetail;
  execute(landmarks: Landmarks, scoreDetail: ScoreDetail): any;
}
