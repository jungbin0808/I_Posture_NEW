import { describe, it, expect } from "vitest";
import { motions, precision, missing, joint, type Pose } from "./engine";
import { body } from "./body";
import { calculateAngleBetweenVectors } from "./vendor/modules/analysis/helpers/angle.helper";
const p: Pose = {};
const coords: Record<string, [number, number]> = {
  Nose: [500, 100],
  LeftEar: [550, 100],
  RightEar: [450, 100],
  LeftEyeOuter: [530, 85],
  RightEyeOuter: [470, 85],
  RightEye: [477, 85],
  LeftShoulder: [600, 250],
  RightShoulder: [400, 250],
  LeftElbow: [650, 420],
  RightElbow: [350, 420],
  LeftWrist: [700, 580],
  RightWrist: [300, 580],
  LeftHip: [570, 600],
  RightHip: [430, 600],
  LeftKnee: [575, 850],
  RightKnee: [425, 850],
  LeftAnkle: [580, 1100],
  RightAnkle: [420, 1100],
  LeftHeel: [575, 1110],
  RightHeel: [425, 1110],
  LeftFootIndex: [640, 1140],
  RightFootIndex: [360, 1140],
  LeftThumb: [705, 580],
  RightThumb: [295, 580],
  LeftPinkyFinger: [710, 590],
  RightPinkyFinger: [290, 590],
};
for (const [k, [x, y]] of Object.entries(coords))
  p[k] = { x, y, z: 0, visibility: 0.99 };
describe("ported original measurement engines", () => {
  it.each(motions.map((m) => [m.key, m]))(
    "%s has a finite calculation using original required inputs",
    async (key, m) => {
      const motion = m as (typeof motions)[number],
        points = Object.fromEntries(motion.required.map((k) => [k, p[k]]));
      const result = await precision(key as string, points, points);
      expect(Number.isFinite(result.angle)).toBe(true);
      expect(result.referenceStatus).toBe("unavailable");
      expect(result).not.toHaveProperty("score");
    },
  );
  it("exposes 52 unique source-backed movements", () => {
    expect(new Set(motions.map((m) => m.key)).size).toBe(52);
  });
  it("measures a right angle rather than the original erroneous 180 degrees", async () => {
    const arm = {
      LeftShoulder: { x: 500, y: 250, visibility: 1 },
      LeftElbow: { x: 500, y: 500, visibility: 1 },
      LeftWrist: { x: 750, y: 500, visibility: 1 },
    };
    expect((await precision("ElbowLeftFlexion", arm, arm)).angle).toBe(90);
    expect(
      calculateAngleBetweenVectors(
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 1 },
      ),
    ).toBe(90);
  });
  it("does not store a zero-length geometric measurement", () => {
    expect(joint(p.LeftHip, p.LeftHip, p.LeftKnee)).toBeNull();
  });
  it("rejects low-confidence and cropped joints", () => {
    expect(
      missing(
        {
          a: { x: -1, y: 10, visibility: 1 },
          b: { x: 500, y: 100, visibility: 0.1 },
          c: { x: 500, y: 900, visibility: 1 },
        },
        ["a", "b", "c"],
        0.75,
      ),
    ).toEqual(["a", "b", "c"]);
  });
  it("rejects missing precision inputs and unknown keys", async () => {
    await expect(precision("ElbowLeftFlexion", {}, {})).rejects.toThrow();
    await expect(precision("unknown", p, p)).rejects.toThrow();
  });
  it("runs all body analysis classes with clean state each time", async () => {
    const one = await body(p, p, p);
    expect(one.metrics).toHaveLength(6);
    expect(await body(p, p, p)).toEqual(one);
  });
});
