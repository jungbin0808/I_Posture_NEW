import { PRECISE_DISEASES } from '../../../common/enums/precise-diseases.enum';
import { Point } from './point.helper';
import { calculateAngle, calculateAngleBetweenVectors } from './angle.helper';

export function getResponse(
  a: Point,
  b: Point,
  c: Point,
  d: Point | null,
  angle: number,
  disease: PRECISE_DISEASES,
): { result: number; score: number; disease: PRECISE_DISEASES | 'NORMAL' } {
  let result = 0;
  if (d === null) {
    result = calculateAngle(a, b, c);
  } else {
    result = calculateAngleBetweenVectors(a, b, c, d);
  }

  return {
    result: result,
    score: (result / angle) * 100,
    disease: result >= angle ? 'NORMAL' : disease,
  };
}
