import { DiseaseResult, ScoreDetail } from '../analysis.types';

export class AnalyticResult {
  public score: number;
  public scoreDetail: ScoreDetail;
  public disease: DiseaseResult[];

  constructor(score: number, scoreDetail: ScoreDetail, disease: DiseaseResult[]) {
    this.score = score;
    this.scoreDetail = scoreDetail;
    this.disease = disease;
  }
}
