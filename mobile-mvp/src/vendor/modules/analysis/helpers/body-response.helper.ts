import { VIDEO_LEVEL } from '../../../common/enums/video.enum';
import { AnalysisResponse, DiseaseResult, ScoreMap } from '../analysis.types';

export function getResponseForOneResult(
  measurementResult: number | string,
  result: ScoreMap,
  scoreMapping: ScoreMap[],
): { response: AnalysisResponse; disease: DiseaseResult[] } {
  const disease: DiseaseResult[] = [];
  if (result.disease != 'NORMAL') {
    disease.push({
      key: result.disease,
      level: getLevel(result.score),
      score: result.score,
    });
  }
  return {
    response: {
      max: result.max + '',
      score: result.score,
      scoreUsage: result.scoreUsage,
      disease: result.disease,
      scoreMapping: scoreMapping,
      result: measurementResult + '',
    },
    disease: disease,
  };
}

export function getResponseForTwoResult(
  measurementResult1: number | string,
  result1: ScoreMap,
  measurementResult2: number | string,
  result2: ScoreMap,
  scoreMapping: ScoreMap[],
): { response: AnalysisResponse; disease: DiseaseResult[] } {
  const disease: DiseaseResult[] = [];
  const diseaseArr: string[] = [];
  if (result1.disease != 'NORMAL') {
    disease.push({
      key: result1.disease,
      level: getLevel(result1.score),
      score: result1.score,
    });
    diseaseArr.push(result1.disease);
  }
  if (result2.disease != 'NORMAL' && !diseaseArr.includes(result2.disease)) {
    disease.push({
      key: result2.disease,
      level: getLevel(result2.score),
      score: result2.score,
    });
    diseaseArr.push(result2.disease);
  }
  return {
    response: {
      max: '왼쪽:' + result1.max + ', 오른쪽:' + result2.max,
      disease: diseaseArr.length > 0 ? diseaseArr.join(',') : 'NORMAL',
      score: getScoreAvg(result1.score, result2.score),
      scoreUsage: (result1.scoreUsage + result2.scoreUsage) / 2,
      scoreMapping: scoreMapping,
      result: '왼쪽:' + measurementResult1 + ', 오른쪽:' + measurementResult2,
    },
    disease: disease,
  };
}

export function getLevel(score: number): string {
  const levelMap = [
    { score: 15, level: VIDEO_LEVEL.LEVEL_3 },
    { score: 25, level: VIDEO_LEVEL.LEVEL_2 },
    { score: 40, level: VIDEO_LEVEL.LEVEL_2 },
    { score: 55, level: VIDEO_LEVEL.LEVEL_1 },
    { score: 62, level: VIDEO_LEVEL.LEVEL_1 },
  ];
  const item = levelMap.find((item) => score == item.score);
  return item?.level || '';
}

function getScoreAvg(score1: number, score2: number): number {
  const avg = (score1 + score2) / 2;
  const scoreMap = [
    { score: 5 },
    { score: 15 },
    { score: 25 },
    { score: 40 },
    { score: 55 },
    { score: 62 },
  ];
  const item = scoreMap.find((item) => avg <= item.score);
  return item?.score || 62;
}
