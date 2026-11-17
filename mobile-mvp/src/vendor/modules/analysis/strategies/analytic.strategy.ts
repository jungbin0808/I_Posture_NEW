import { Landmarks } from '../analysis.types';
import { AnalyticResult } from './analytic.result';

export interface AnalyticStrategy {
  execute(landmarks: Landmarks): Promise<AnalyticResult>;
}
