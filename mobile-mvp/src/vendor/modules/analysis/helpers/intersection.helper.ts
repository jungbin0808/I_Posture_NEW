import { Point } from './point.helper';

export function getIntersectionPoint(a: Point, b: Point, c: Point, d: Point): Point | null {
  const { x: x1, y: y1 } = a;
  const { x: x2, y: y2 } = b;
  const { x: x3, y: y3 } = c;
  const { x: x4, y: y4 } = d;
  // Hệ số của phương trình tham số
  const a1 = y2 - y1;
  const b1 = x1 - x2;
  const c1 = a1 * x1 + b1 * y1;

  const a2 = y4 - y3;
  const b2 = x3 - x4;
  const c2 = a2 * x3 + b2 * y3;

  const determinant = a1 * b2 - a2 * b1;

  if (determinant === 0) {
    // Hai đường thẳng song song hoặc trùng nhau
    return null;
  } else {
    const x = (b2 * c1 - b1 * c2) / determinant;
    const y = (a1 * c2 - a2 * c1) / determinant;
    return { x, y };
  }
}
