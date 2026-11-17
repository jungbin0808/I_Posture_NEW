import { Point } from './point.helper';

export function calculateDistance(a: Point, b: Point): number {
  const { x: x1, y: y1 } = a;
  const { x: x2, y: y2 } = b;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return Math.round(distance * 100) / 100;
}
